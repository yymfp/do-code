

// 安装 npm install -g promises-aplus-tests
// 执行测试命令  promises-aplus-tests _promise.js

const PENDING = "PENDING";
const FULFILLED = "FULFILLED";
const REJECTED = "REJECTED";

const resolvePromise = (promise2, x, resolve, reject) => {
  // 自己等待自己导致循环引用 返回异常调用reject结束promise链
  if (promise2 === x) {
    return reject(
      new TypeError("Chaining cycle detected for promise #<Promise>")
    );
  }

  // 如果同时调用 resolvePromise 和 rejectPromise ，或者对同一参数进行多次调用，则第一个调用优先，并且忽略任何后续调用。
  let used;

  if ((typeof x === "object" && x !== null) || typeof x === "function") {
    try {
      let then = x.then;
      // 代表x是一个promise
      if (typeof then === "function") {
        // x代表的这个promise执行完 成功的话会执行then的成功回调 失败的话会执行then的失败回调
        // 只需要把最外层的resolve和reject传递进去等待这个链式的最终结束
        then.call(
          x,
          (res) => {
            if (used) return;
            used = true;
            // 有可能res也是一个promise 递归判断直到结束
            resolvePromise(promise2, res, resolve, reject);
          },
          (err) => {
            if (used) return;
            used = true;
            reject(err);
          }
        );
      } else {
        // 普通对象
        resolve(x);
      }
    } catch (e) {
      if (used) return;
      used = true;
      reject(e);
    }
  } else {
    // x是普通值，直接调用resolve结束promise
    resolve(x);
  }
};

class _promise {
  constructor(executor) {
    // 记录状态
    this.state = PENDING;
    // 成功状态值
    this.value = undefined;
    // 失败状态值
    this.reason = undefined;

    // 记录需要执行成功的回调列表
    this.onResolveCallbacks = [];
    // 记录需要执行失败的回调列表
    this.onRejectedCallbacks = [];

    let resolve = (value) => {
      // 如果当前是pending状态
      if (this.state === PENDING) {
        this.state = FULFILLED;
        this.value = value;
        this.onResolveCallbacks.forEach((cb) => cb());
      }
    };

    let reject = (reason) => {
      // 如果当前是pending状态
      if (this.state === PENDING) {
        this.state = REJECTED;
        this.reason = reason;
        this.onRejectedCallbacks.forEach((cb) => cb());
      }
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      this.reject(e);
    }
  }

  then(onFulFilled, onRejected) {
    // 判断参数类型
    onFulFilled = typeof onFulFilled === "function" ? onFulFilled : (v) => v;
    onRejected =
      typeof onRejected === "function"
        ? onRejected
        : (error) => {
            throw error;
          };

    // 每次调用都返回一个新的promise
    let promise2 = new _promise((resolve, reject) => {
      // 如果当前promise状态为成功
      if (this.state === FULFILLED) {
        // setTimeout模拟promise产生的微任务，then里面的方法想要执行，需要等待promise的状态完成或失败
        setTimeout(() => {
          try {
            // 执行成功的回调
            const x = onFulFilled(this.value);
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            // 异常的话，直接调用新产生的promise2的reject方法，结束promise链
            reject(e);
          }
        }, 0);
      }

      // 如果当前promise状态为失败
      if (this.state === REJECTED) {
        setTimeout(() => {
          try {
            const x = onRejected(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        }, 0);
      }

      // 如果当前promsie为pending 说明上一个promise还没结束 需要等待其结束后 再依次去执行链式then中所追加的所有回调方法
      // 回调方法中也有可能返回新的promise，当前的then产生的promise2的状态取决于返回的新的promise的状态 也就是x的状态
      if (this.state === PENDING) {
        this.onResolveCallbacks.push(() => {
          setTimeout(() => {
            try {
              const x = onFulFilled(this.value);
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          }, 0);
        });
        this.onRejectedCallbacks.push(() => {
          setTimeout(() => {
            try {
              const x = onRejected(this.reason);
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          }, 0);
        });
      }
    });
    return promise2;
  }
}

_promise.defer = _promise.deferred = function () {
  let dfd = {};
  dfd.promise = new _promise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  });
  return dfd;
};

module.exports = _promise;