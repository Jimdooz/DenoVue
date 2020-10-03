const CONNECTING = 0;   //		Socket has been created.The connection is not yet open.
const OPEN = 1;         //	The connection is open and ready to communicate.
const CLOSING = 2;      //	The connection is in the process of closing.
const CLOSED = 3;       //	The connection is closed or couldn't be opened.

class MessageSocket {
    constructor(head, namespace = '/', body = []){
        if(typeof head != "string") throw 'head must be a string';
        if(typeof namespace != "string") throw 'namespace must be a string';
        this.head = head;
        this.body = Array.isArray(body) ? body : [body];
        this.namespace = namespace;
    }

    static encode(messageSocket){
        return JSON.stringify(messageSocket);
    }
    static decode(messageSocket){
        return JSON.parse(messageSocket);
    }
}

class SocketInstance {
    constructor(namespace, parent){
        this.namespace = namespace;
        this.parent = parent;

        this.onMessageEvents = {};
        this.onOpenEvents = [];
        this.onErrorEvents = [];
        this.onCloseEvents = [];
        
        this.emitWaiting = [];
    }

    emit(head, ...body){
        const ws = this.websocket();
        const message = new MessageSocket(head, this.namespace, [...body]);
        if (ws.readyState == OPEN){
            this.websocket().send(MessageSocket.encode(message));
        }else{
            this.emitWaiting.push(message);
        }
    }

    on(head, fn){
        if(typeof fn === 'function'){
            if(head == 'connect') this.onOpenEvents.push(fn);
            else if(head == 'error') this.onErrorEvents.push(fn);
            else if(head == 'disconnect') this.onCloseEvents.push(fn);
            else {
                if(!this.onMessageEvents[head]) this.onMessageEvents[head] = [];
                this.onMessageEvents[head].push(fn);
            }
        }
    }

    onClose(){}

    onError(){
        for (const e of this.onErrorEvents) e();
    }

    onOpen(){
        if(this.emitWaiting.length > 0){
            for (const m of this.emitWaiting) {
                console.log(m.head, ...m.body);
                this.emit(m.head, ...m.body);
            } 
            this.emitWaiting = [];
        }
        for(const e of this.onOpenEvents) e();
    }

    onMessage(message){
        if(this.onMessageEvents[message.head])
            for(const e of this.onMessageEvents[message.head]) e(...message.body);
    }

    websocket(){
        return this.parent.getSocket();
    }
}

class Socket extends SocketInstance {
    /**
     * Create an instance of a socket
     * @param url the url of the connection
     * @param options the options object
     */
    constructor(url = "/", options){
        super();
        this.parent = this;

        const urlComposer = this.urlConnection(url);
        this.urlConnection = `ws${window.location.protocol.includes("https") ? 's' : ''}://${urlComposer.hostname}:${urlComposer.port}/websocket${urlComposer.pathname}`;
        this.protocols = options && options instanceof object ? options.protocols : undefined;

        this.namespace = urlComposer.pathname;
        this.instances = {};

        this.instances[this.namespace] = this;
        this.connectSocket();
    }

    connectSocket() {
        this.ws = new WebSocket(this.urlConnection, this.protocols);
        this.ws.addEventListener('open', (...datas) => { this.onOpenSocket(...datas) });
        this.ws.addEventListener('message', (...datas) => { this.onMessageSocket(...datas); });
        this.ws.addEventListener('error', (...datas) => { this.onErrorSocket(...datas); });
        this.ws.addEventListener('close', (...datas) => { this.onCloseSocket(...datas); });
    }

    getSocket() {
        if (this.ws.readyState == CLOSING || this.ws.readyState == CLOSED) this.connectSocket();
        return this.ws;
    }

    onOpenSocket(event) {
        for (const s in this.instances) this.instances[s].onOpen();
    }

    onErrorSocket(event) {
        console.log("Error :", event);
    }

    onCloseSocket(event) {
        console.log("Connection closed :", event);
    }

    onMessageSocket(event) {
        const message = MessageSocket.decode(event.data);
        if (this.instances[message.namespace]) {
            this.instances[message.namespace].onMessage(message);
        }
    }

    of(namespace){
       if(!this.instances[this.namespace]) this.instances[this.namespace] = new SocketInstance(this.namespace, this);
       return this.instances[this.namespace];
    }

    urlConnection(url){
        let urlComposer;
        try {
            urlComposer = url ? new URL(url) : {...window.location};
            if(!url) urlComposer.pathname = '/';
        } catch (error) {
            urlComposer = {...window.location};
            urlComposer.pathname = url ? url : '/';
            urlComposer.port = 3000;
        }
        return urlComposer;
        // this.namespace = urlComposer.pathname;
        // return `ws://${urlComposer.hostname}:${urlComposer.port}/websocket${urlComposer.pathname}`;
    }
}

export default Socket;
