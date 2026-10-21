import { Queue } from "../../src/domain/waitlistQueue.js";

const q = new Queue();
console.log(q.size);        // 0
console.log(q.peek());      // undefined
console.log(q.dequeue());   // undefined (empty queue, no crash)

q.enqueue("Ada");
q.enqueue("Tunde");
q.enqueue("Chioma");
console.log(q.size);        // 3
console.log(q.peek());      // Ada
console.log(q.dequeue());   // Ada
console.log(q.dequeue());   // Tunde
console.log(q.size);        // 1
console.log(q.peek());      // Chioma
console.log(q.dequeue());   // Chioma
console.log(q.size);        // 0
console.log(q.peek());      // undefined

q.enqueue("Late");          // joining again after the line was emptied
console.log(q.peek());      // Late
console.log(q.size);        // 1