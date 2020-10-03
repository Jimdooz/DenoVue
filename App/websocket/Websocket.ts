import { WebSocket, acceptWebSocket, isWebSocketCloseEvent, acceptable } from 'https://deno.land/std@v0.72.0/ws/mod.ts';
import { serve, Server, serveTLS } from "https://deno.land/std@v0.72.0/http/server.ts";
import { v4 } from "https://deno.land/std@v0.72.0/uuid/mod.ts";
import { Emitter } from "../utilities/Emitter.ts";

/**
 * #TODO à traduire parce que je suis fatigué warzazat
 * Classe permettant de représenter un type de packet qui sera envoyé et reçu par serveur/client
 * `head` c'est l'entête du packet c'est un simple string qui peut contenir n'importe quoi
 * `namespace` c'est le domaine sur lequel le message a été émis, en général c'est / mais selon l'url demandé par exemple ws://127.0.0.1:3000/websockets/coucou le namespace sera coucou
 * `body` c'est une liste qui peut être nulle qui comporte toutes les données qu'on souhaite envoyer
 */
class MessageSocket {
  head : string;
  body : Array<any>;
  namespace: string;
  constructor(head : string, namespace : string, ...body : any){
    this.head = head;
    this.body = body;
    this.namespace = namespace;
  }

  encode() : string{
    return MessageSocket.encode(this);
  }

  static encode(messageSocket : MessageSocket) : string{
      return JSON.stringify(messageSocket);
  }

  static decode(messageSocket : string) : MessageSocket{
    let message;
    try{
      message = JSON.parse(messageSocket);
    }catch(e){
      throw new TypeError("Socket message is not an object");
    } 

    if(!message.head || typeof message.head != "string")
      throw new TypeError("Invalid head in socket message");
    if(!message.namespace || typeof message.namespace != "string")
      throw new TypeError("Socket message have an invalid namespace");
    if(message.body && !Array.isArray(message.body))
      throw new TypeError("Invalid body socket message");
    if(!message.body)
      message.body = [];
      
    return message;
  }

}

class SocketConnection extends Emitter {
  id: string;
  ws: WebSocket;
  sockets: Map<string, Socket>;
  io: IoSystem;

  constructor(id: string, io: IoSystem, ws: WebSocket) {
    super();
    this.id = id;
    this.ws = ws;
    this.sockets = new Map<string, Socket>();
    this.io = io;

    this.init();
  }

  private async init() {
    for await (const event of this.ws) {
      const message = typeof event === "string" ? event : "";

      if (message) {
        // console.log(message);
        try {
          const m = MessageSocket.decode(message);
          const namespace = m.namespace;
          if (this.io.namespaceExist(namespace)) {
            (await this.connectNamespace(this.io.of(namespace))).receiveMessage(m);
          }
        } catch (e) {
          this.sockets.forEach(s => {
            s.receiveError(e);
          })
        }
      }

      if (!message && isWebSocketCloseEvent(event)) {
        // console.log("Deconnexion user", this.id);
        for (const [idSocket, socket] of this.sockets) {
          socket.disconnect();
        }
        this.propage("close", this.id);
      }
    }
  }

  async disconnect() {
    for (const s in this.sockets) {
      const socket = this.sockets.get(s);
      if (socket) {
        socket.disconnect();
        this.sockets.delete(s);
      }
    }
  }

  getSocket(namespaceName: string): Socket {
    const socket = this.sockets.get(namespaceName);
    if (!socket) throw new ReferenceError("socket doesn't exist");
    return socket;
  }

  async connectNamespace(namespace: Namespace): Promise<Socket> {
    const s = this.sockets.get(namespace.name);
    if (s) return s;
    const newSocket = new Socket(this.ws, { id: this.id + namespace.name, namespace });
    this.sockets.set(namespace.name, newSocket);
    namespace.addSocket(newSocket);
    return newSocket;
  }
}

export interface SocketResponseChoice {
  (...body: any): void;
};

export interface SocketResponse {
  socket: any,
  error: SocketResponseChoice,
  success: SocketResponseChoice,
}

class Socket extends Emitter {
  readonly ws : WebSocket;
  readonly id : string;
  readonly namespace : Namespace;
  readonly rooms: Map<string, SocketRoom> = new Map<string, SocketRoom>();

  constructor(ws: WebSocket, options : { id : string, namespace : Namespace }) {
    super();
    this.namespace = options.namespace;
    this.id = options.id;
    this.ws = ws;
  }

  async emit(head : string, ...body : any) : Promise<Socket> {
    if(this.ws.isClosed) {
      this.disconnect();
      return this;
    }
    await this.ws.send( new MessageSocket(head, this.namespace.name, ...body).encode() );
    return this;
  }

  async broadcast(head : string, ...body : any) : Promise<Socket>{
    const promises = [];
    for (let socket of this.namespace.sockets.values()) {
      if (socket.id != this.id) promises.push( socket.emit(head, ...body) );
    }
    await Promise.all(promises);
    return this;
  }

  async disconnect(){
    this.namespace.disconnectSocket(this.id);
    for(const [roomName, room] of this.rooms){
      room.disconnectSocket(this.id);
    }
    this.propage('disconnect');
  }

  /**
   * Link an event function to a `head`
   * 
   * `connect` when the socket is connected
   * `error` when an error occur
   * `disconnect` when the socket is off
   * other for a socket message
   *
   * @param head the head value
   * @param event the function connected to the head when the head is emitted
   */
  on(head : string, event : Function){
    super.addListener(head, event);
  }

  off(head : string, event : Function) {
    super.removeListener(head, event);
  }

  receiveMessage(message : MessageSocket){
    this.propageContext(message.head, {
      socket : this,
      error(...body: any) { this.socket.emit(message.head + '#error', ...body); },
      success(...body: any) { this.socket.emit(message.head + '#success', ...body); },
    }, ...message.body);
  }

  receiveError(error : Error){
    this.propage("error", error);
  }

  join(roomName : string){
    const room = this.namespace.joinSocketRoom(this, roomName);
    this.rooms.set(roomName, room);
  }

  leave(roomName: string) {
    this.namespace.leaveSocketRoom(this, roomName);
    this.rooms.delete(roomName);
  }

  to(roomName : string) : SocketRoom {
    if(!this.rooms.get(roomName)) this.join(roomName);
    const room = this.rooms.get(roomName);
    if(!room) throw new ReferenceError("The room doesn't exist");
    return room.copyExclude(this);
  }
}

class SocketRoom extends Emitter {
  name : string;
  sockets : Map<string, Socket>;
  namespace : Namespace;
  excludeId : string | undefined;

  constructor(name : string, namespace : Namespace, excludeId? : string){
    super();
    this.name = name;
    this.sockets = new Map<string, Socket>();
    this.namespace = namespace;
    this.excludeId = excludeId;
  }

  async emit(head : string, ...body : any) : Promise<void>{
    const promises = [];
    for (let socket of this.sockets.values()) {
      promises.push( socket.emit(head, ...body) );
    }
    await Promise.all(promises);
  }

  async broadcast(head: string, ...body: any): Promise<void> {
    const promises = [];
    for (let socket of this.sockets.values()) {
      if (this.excludeId != socket.id) promises.push( socket.emit(head, ...body) );
    }
    await Promise.all(promises);
  }

  union(name : string, excludeId? : string) : SocketRoom {
    const socketRoom = this.namespace.rooms.get(name);
    if(!socketRoom) throw "The room doesn't exist";
    const newRoom = new SocketRoom(v4.generate(), this.namespace, excludeId);
    newRoom.sockets = new Map<string, Socket>([...this.sockets, ...socketRoom.sockets]);
    return newRoom;
  }

  addSocket(socket: Socket){
    if(!this.sockets.has(socket.id)) super.propage("join", socket);
    this.sockets.set(socket.id, socket);
  }

  removeSocket(socket: Socket) {
    if (this.sockets.has(socket.id)) super.propage("leave", socket);
    this.sockets.delete(socket.id);
  }

  existSocket(socket : Socket) : boolean{
    return this.sockets.has(socket.id);
  }

  copyExclude(exclude : Socket) : SocketRoom{
    const newRoom = new SocketRoom(v4.generate(), this.namespace, exclude.id);
    newRoom.sockets = new Map<string, Socket>([...this.sockets]);
    return newRoom;
  }

  disconnectSocket(id : string) : boolean {
    if(this.sockets.get(id)) return false;
    this.sockets.delete(id);
    return true;
  }

  on(head: string, event: Function) {
    super.addListener(head, event);
  }

  off(head: string, event: Function) {
    super.removeListener(head, event);
  }
}

class Namespace extends Emitter {
  readonly name : string;
  readonly sockets : Map<string, Socket>;
  readonly rooms : Map<string, SocketRoom>;
  private connectionEvent : Function = () => {};

  constructor(name : string){
    super();
    this.name = name;
    this.sockets = new Map<string, Socket>();
    this.rooms = new Map<string, SocketRoom>();
  }

  async emit(head : string, ...body : any) {
    for await (const socket of this.sockets.values()) {
      socket.emit(head, ...body);
    }
  }

  private autoRoom(roomName : string) : SocketRoom {
    let socketRoom = this.rooms.get(roomName);
    if (!socketRoom) {
      socketRoom = new SocketRoom(roomName, this);
      this.rooms.set(roomName, socketRoom);
    }
    return socketRoom;
  }

  to(roomName : string) : SocketRoom {
    return this.autoRoom(roomName);
  }

  room(roomName : string) : SocketRoom {
    return this.to(roomName);
  }

  joinSocketRoom(socket : Socket, roomName : string) : SocketRoom {
    const socketRoom = this.autoRoom(roomName);
    if (socketRoom.existSocket(socket)) socketRoom;
    socketRoom.addSocket(socket);
    return socketRoom;
  }

  leaveSocketRoom(socket : Socket, roomName : string) : boolean {
    let socketRoom = this.rooms.get(roomName);
    if (!socketRoom) return false;
    if (!socketRoom.existSocket(socket)) return false;
    console.log(`${socketRoom.name} remove socket ${socket.id}`);
    socketRoom.removeSocket(socket);
    return true;
  }

  addSocket(socket : Socket) : boolean {
    if(this.sockets.get(socket.id)) return false;
    this.sockets.set(socket.id, socket);
    this.connectionEvent(socket);
    this.propage("connection", socket);
    return true;
  }

  disconnectSocket(id : string) : boolean {
    if(!this.sockets.get(id)) return false;
    this.sockets.delete(id);
    return true;
  }

  async on(route: string, cb: Function) {
    if (route === "connection") {
      super.addListener(route, cb);
    }
  }
}

class IoSystem extends Namespace {
  private socketsConnection : Map<string, SocketConnection>;
  private namespaces : Map<string, Namespace>;
  private server : Server;
  private $middlewares : Array<Function>;

  constructor(initializator : number | Server = 3000) {
    super('/');
    this.socketsConnection = new Map<string, SocketConnection>();
    this.namespaces = new Map<string, Namespace>();
    this.namespaces.set('/', this);
    this.server = typeof initializator === 'number' ? serve({ port: initializator }) : initializator;
    this.$middlewares = new Array();
    this.listen();
  }

  of(name : string) : Namespace{
    let namespaceWanted = this.namespaces.get(name);
    if (!namespaceWanted) {
      namespaceWanted = new Namespace(name);
      this.namespaces.set(name, namespaceWanted);
    }
    return namespaceWanted;
  }

  use(middleware : Function) : void {
    this.$middlewares.push(middleware);
  }

  private async listen() : Promise<void> {
    for await (const req of this.server) {
      this.requestHandler(req).catch((e) => {
        console.log("REQUEST HANDLER WS", e);
      })
    }
  }

  async socketEventHandlers(ws: WebSocket, namespace? : string): Promise<void | Socket> {
    const socketId = v4.generate();
    namespace = namespace ? namespace : '/';

    if(!this.namespaces.get(namespace)){
      ws.close(0, "The namespace doesn't exist");
    }else{
      const socketConnection = new SocketConnection(socketId, this, ws);
      const namespaceWanted = this.of(namespace);
      this.socketsConnection.set( socketId, socketConnection );
      const socket = await socketConnection.connectNamespace(namespaceWanted);
      socketConnection.addListener("close", (id : string) => {
        this.deleteSocketConnection(id);
      });
      return socket;
    }
  }

  async requestHandler(req : any) : Promise<void>{
    if (acceptable(req)) {
      const { conn, r: bufReader, w: bufWriter, headers } = req;
      const sock = await acceptWebSocket({ conn, bufReader, bufWriter, headers });
      const namespace = req.url.substring("/websocket".length);
      const socketConnected = await this.socketEventHandlers(sock, namespace);
      this.$middlewares.forEach(async (middleware) => {
        await middleware(socketConnected, req);
      });
    }
  }

  deleteSocketConnection(id : string) : boolean{
    return this.socketsConnection.delete(id);
  }

  namespaceExist(name : string) : boolean {
    return this.namespaces.get(name) ? true : false;
  }
}

export { SocketConnection, MessageSocket, Socket, SocketRoom, Namespace, IoSystem };