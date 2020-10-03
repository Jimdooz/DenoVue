// Copyright 2020-2020 the Diister authors. All rights reserved. MIT license.

export type EmitterMap = Map<string, Array<Function>>;

/** Class representing an emitter of listens 
 * `coucou`
 * ```ts
 * class subclass extends Emitter {
 *    constructor(){
 *      super();
 *      //Your constructor
 *    }
 * }
 *  ```
 */
class Emitter {
    private emitterMap: EmitterMap = new Map<string, Array<Function>>();
    constructor() { }

    /**
     * Link an listen function to a `head`
     * ```ts
     * instance.on("hello", () => {
     *    console.log("Hello emitted !");
     * })
     * ```
     * 
     * @param head the head value
     * @param listen the function connected to the head when the head is emitted
     */
    addListener(head: string, listen: Function): void {
        if (!this.emitterMap.has(head)) this.emitterMap.set(head, new Array<Function>());
        const emitter = this.emitterMap.get(head);
        if (emitter) emitter.push(listen);
    }

    /**
     * UnLink a listen function already connected from a head
     * @param head the head value
     * @param listen the function connected to the head
     * @return true if the operation succeed, false otherwise
     */
    removeListener(head: string, listen: Function): boolean {
        const emitter = this.emitterMap.get(head);
        if (emitter) {
            const indexlisten = emitter.indexOf(listen);
            if (indexlisten >= 0) {
                emitter.splice(indexlisten, 1);
                return true;
            }
        }
        return false;
    }

    /**
     * Emit a `head` listen, this function is going to call every listen function who listen to him
     * ```ts
     * this.emit("hello", "world"); //Emit 'hello' with "world" data passed
     * ```
     * @param head the head value
     * @param body the datas passed to the listen who listen the head
     */
    protected propage(head: string, ...body: any): void {
        const emitter = this.emitterMap.get(head);
        if (emitter) {
            emitter.forEach(listen => {
                listen(...body);
            });
        }
    }

    /**
     * Emit a `head` listen, this function is going to call every listen function who listen to him
     * ```ts
     * this.emit("hello", { 'a' : 'b' }, "world"); //Emit 'hello' with "world" data passed
     * ```
     * @param head the head value
     * @param context the context of the function called
     * @param body the datas passed to the listen who listen the head
     */
    protected propageContext(head: string, context: any, ...body: any): void {
        const emitter = this.emitterMap.get(head);
        if (emitter) {
            emitter.forEach(listen => {
                listen.bind(context)(...body);
            });
        }
    }
}

export { Emitter };