var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var lib = {exports: {}};

/*
  Copyright © 2018 Andrew Powell

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at http://mozilla.org/MPL/2.0/.

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of this Source Code Form.
*/

const noop = () => {};
const levels = Symbol('log-levels');
const instance = Symbol('log-instance');

var MethodFactory_1 = class MethodFactory {
  constructor(logger) {
    this[instance] = logger;
    this[levels] = {
      TRACE: 0,
      DEBUG: 1,
      INFO: 2,
      WARN: 3,
      ERROR: 4,
      SILENT: 5
    };
  }

  get levels() {
    return this[levels];
  }

  get logger() {
    return this[instance];
  }

  set logger(logger) {
    this[instance] = logger;
  }

  get methods() {
    return Object.keys(this.levels)
      .map((key) => key.toLowerCase())
      .filter((key) => key !== 'silent');
  }

  // eslint-disable-next-line class-methods-use-this
  bindMethod(obj, methodName) {
    const method = obj[methodName];
    if (typeof method.bind === 'function') {
      return method.bind(obj);
    }

    try {
      return Function.prototype.bind.call(method, obj);
    } catch (e) {
      // Missing bind shim or IE8 + Modernizr, fallback to wrapping
      return function result() {
        // eslint-disable-next-line prefer-rest-params
        return Function.prototype.apply.apply(method, [obj, arguments]);
      };
    }
  }

  distillLevel(level) {
    let result = level;

    if (typeof result === 'string' && typeof this.levels[result.toUpperCase()] !== 'undefined') {
      result = this.levels[result.toUpperCase()];
    }

    if (this.levelValid(result)) {
      return result;
    }

    return false;
  }

  levelValid(level) {
    if (typeof level === 'number' && level >= 0 && level <= this.levels.SILENT) {
      return true;
    }

    return false;
  }

  /**
   * Build the best logging method possible for this env
   * Wherever possible we want to bind, not wrap, to preserve stack traces.
   * Since we're targeting modern browsers, there's no need to wait for the
   * console to become available.
   */
  // eslint-disable-next-line class-methods-use-this
  make(methodName) {
    if (methodName === 'debug') {
      // eslint-disable-next-line no-param-reassign
      methodName = 'log';
    }

    /* eslint-disable no-console */
    if (typeof console[methodName] !== 'undefined') {
      return this.bindMethod(console, methodName);
    } else if (typeof console.log !== 'undefined') {
      return this.bindMethod(console, 'log');
    }

    /* eslint-enable no-console */
    return noop;
  }

  replaceMethods(logLevel) {
    const level = this.distillLevel(logLevel);

    if (level == null) {
      throw new Error(`loglevelnext: replaceMethods() called with invalid level: ${logLevel}`);
    }

    if (!this.logger || this.logger.type !== 'LogLevel') {
      throw new TypeError(
        'loglevelnext: Logger is undefined or invalid. Please specify a valid Logger instance.'
      );
    }

    this.methods.forEach((methodName) => {
      const { [methodName.toUpperCase()]: methodLevel } = this.levels;

      this.logger[methodName] = methodLevel < level ? noop : this.make(methodName);
    });

    // Define log.log as an alias for log.debug
    this.logger.log = this.logger.debug;
  }
};

/*
  Copyright © 2018 Andrew Powell

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at http://mozilla.org/MPL/2.0/.

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of this Source Code Form.
*/

const MethodFactory$1 = MethodFactory_1;

const defaults$1 = {
  level: (opts) => `[${opts.level}]`,
  name: (opts) => opts.logger.name,
  template: '{{time}} {{level}} ',
  time: () => new Date().toTimeString().split(' ')[0]
};

var PrefixFactory_1 = class PrefixFactory extends MethodFactory$1 {
  constructor(logger, options) {
    super(logger);
    this.options = Object.assign({}, defaults$1, options);
  }

  interpolate(level) {
    return this.options.template.replace(/{{([^{}]*)}}/g, (stache, prop) => {
      const fn = this.options[prop];

      if (fn) {
        return fn({ level, logger: this.logger });
      }

      return stache;
    });
  }

  make(methodName) {
    const og = super.make(methodName);

    return (...args) => {
      const output = this.interpolate(methodName);
      const [first] = args;

      if (typeof first === 'string') {
        // eslint-disable-next-line no-param-reassign
        args[0] = output + first;
      } else {
        args.unshift(output);
      }

      og(...args);
    };
  }
};

/*
  Copyright © 2018 Andrew Powell

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at http://mozilla.org/MPL/2.0/.

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of this Source Code Form.
*/

const PrefixFactory = PrefixFactory_1;

const MethodFactory = MethodFactory_1;

const defaults = {
  factory: null,
  level: 'warn',
  name: +new Date(),
  prefix: null
};

var LogLevel_1 = class LogLevel {
  constructor(options) {
    // implement for some _very_ loose type checking. avoids getting into a
    // circular require between MethodFactory and LogLevel
    this.type = 'LogLevel';
    this.options = Object.assign({}, defaults, options);
    this.methodFactory = options.factory;

    if (!this.methodFactory) {
      const factory = options.prefix
        ? new PrefixFactory(this, options.prefix)
        : new MethodFactory(this);
      this.methodFactory = factory;
    }

    if (!this.methodFactory.logger) {
      this.methodFactory.logger = this;
    }

    this.name = options.name || '<unknown>';

    // this.level is a setter, do this after setting up the factory
    this.level = this.options.level;
  }

  get factory() {
    return this.methodFactory;
  }

  set factory(factory) {
    // eslint-disable-next-line no-param-reassign
    factory.logger = this;
    this.methodFactory = factory;
    this.methodFactory.replaceMethods(this.level);
  }

  disable() {
    this.level = this.levels.SILENT;
  }

  enable() {
    this.level = this.levels.TRACE;
  }

  get level() {
    return this.currentLevel;
  }

  set level(logLevel) {
    const level = this.methodFactory.distillLevel(logLevel);

    if (level === false || level == null) {
      throw new RangeError(`loglevelnext: setLevel() called with invalid level: ${logLevel}`);
    }

    this.currentLevel = level;
    this.methodFactory.replaceMethods(level);

    if (typeof console === 'undefined' && level < this.levels.SILENT) {
      // eslint-disable-next-line no-console
      console.warn('loglevelnext: console is undefined. The log will produce no output.');
    }
  }

  get levels() {
    // eslint-disable-line class-methods-use-this
    return this.methodFactory.levels;
  }
};

/*
  Copyright © 2018 Andrew Powell

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at http://mozilla.org/MPL/2.0/.

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of this Source Code Form.
*/

(function (module) {
	const LogLevel = LogLevel_1;
	const MethodFactory = MethodFactory_1;
	const PrefixFactory = PrefixFactory_1;

	const factories = Symbol('log-factories');

	class DefaultLogger extends LogLevel {
	  constructor() {
	    super({ name: 'default' });

	    this.cache = { default: this };
	    this[factories] = { MethodFactory, PrefixFactory };
	  }

	  get factories() {
	    return this[factories];
	  }

	  get loggers() {
	    return this.cache;
	  }

	  create(opts) {
	    let options;

	    if (typeof opts === 'string') {
	      options = { name: opts };
	    } else {
	      options = Object.assign({}, opts);
	    }

	    if (!options.id) {
	      options.id = options.name;
	    }

	    const { name, id } = options;
	    const defaults = { level: this.level };

	    if (typeof name !== 'string' || !name || !name.length) {
	      throw new TypeError('You must supply a name when creating a logger.');
	    }

	    let logger = this.cache[id];
	    if (!logger) {
	      logger = new LogLevel(Object.assign({}, defaults, options));
	      this.cache[id] = logger;
	    }
	    return logger;
	  }
	}

	module.exports = new DefaultLogger();

	// TypeScript fix
	module.exports.default = module.exports; 
} (lib));

var libExports = lib.exports;
var loglevelnext = /*@__PURE__*/getDefaultExportFromCjs(libExports);

var log = loglevelnext.create("dcmjs");
/**
 * A validation log shows issues with data validation, and not internal issues itself.
 * This is validation.dcmjs to group the validation issues into a single validation set to allow
 * turning validation on/off.
 */

var validationLog = loglevelnext.create("validation.dcmjs");

/* eslint no-bitwise: 0 */
var BitArray = {
  getBytesForBinaryFrame: getBytesForBinaryFrame,
  pack: pack,
  unpack: unpack
};

function getBytesForBinaryFrame(numPixels) {
  // Check whether the 1-bit pixels exactly fit into bytes
  var remainder = numPixels % 8; // Number of bytes that work on an exact fit

  var bytesRequired = Math.floor(numPixels / 8); // Add one byte if we have a remainder

  if (remainder > 0) {
    bytesRequired++;
  }

  return bytesRequired;
}

function pack(pixelData) {
  var numPixels = pixelData.length;
  log.debug("numPixels: " + numPixels);
  var length = getBytesForBinaryFrame(numPixels); //log.log('getBytesForBinaryFrame: ' + length);

  var bitPixelData = new Uint8Array(length);
  var bytePos = 0;

  for (var i = 0; i < numPixels; i++) {
    // Compute byte position
    bytePos = Math.floor(i / 8);
    var pixValue = pixelData[i] !== 0; //log.log('i: ' + i);
    //log.log('pixValue: ' + pixValue);
    //log.log('bytePos: ' + bytePos);

    var bitPixelValue = pixValue << i % 8; //log.log('current bitPixelData: ' + bitPixelData[bytePos]);
    //log.log('this bitPixelValue: ' + bitPixelValue);

    bitPixelData[bytePos] |= bitPixelValue; //log.log('new bitPixelValue: ' + bitPixelData[bytePos]);
  }

  return bitPixelData;
} // convert a packed bitwise pixel array into a byte-per-pixel
// array with 255 corresponding to each set bit in the bit array


function unpack(bitPixelArray) {
  var bitArray = new Uint8Array(bitPixelArray);
  var byteArray = new Uint8Array(8 * bitArray.length);

  for (var byteIndex = 0; byteIndex < byteArray.length; byteIndex++) {
    var bitIndex = byteIndex % 8;
    var bitByteIndex = Math.floor(byteIndex / 8);
    byteArray[byteIndex] = 255 * ((bitArray[bitByteIndex] & 1 << bitIndex) >> bitIndex);
  }

  return byteArray;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    enumerableOnly && (symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    })), keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = null != arguments[i] ? arguments[i] : {};
    i % 2 ? ownKeys(Object(source), !0).forEach(function (key) {
      _defineProperty(target, key, source[key]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    });
  }

  return target;
}

function _typeof(obj) {
  "@babel/helpers - typeof";

  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  }, _typeof(obj);
}

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  Object.defineProperty(Constructor, "prototype", {
    writable: false
  });
  return Constructor;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function");
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      writable: true,
      configurable: true
    }
  });
  Object.defineProperty(subClass, "prototype", {
    writable: false
  });
  if (superClass) _setPrototypeOf(subClass, superClass);
}

function _getPrototypeOf(o) {
  _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
    return o.__proto__ || Object.getPrototypeOf(o);
  };
  return _getPrototypeOf(o);
}

function _setPrototypeOf(o, p) {
  _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
    o.__proto__ = p;
    return o;
  };

  return _setPrototypeOf(o, p);
}

function _isNativeReflectConstruct() {
  if (typeof Reflect === "undefined" || !Reflect.construct) return false;
  if (Reflect.construct.sham) return false;
  if (typeof Proxy === "function") return true;

  try {
    Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}));
    return true;
  } catch (e) {
    return false;
  }
}

function _construct(Parent, args, Class) {
  if (_isNativeReflectConstruct()) {
    _construct = Reflect.construct;
  } else {
    _construct = function _construct(Parent, args, Class) {
      var a = [null];
      a.push.apply(a, args);
      var Constructor = Function.bind.apply(Parent, a);
      var instance = new Constructor();
      if (Class) _setPrototypeOf(instance, Class.prototype);
      return instance;
    };
  }

  return _construct.apply(null, arguments);
}

function _isNativeFunction(fn) {
  return Function.toString.call(fn).indexOf("[native code]") !== -1;
}

function _wrapNativeSuper(Class) {
  var _cache = typeof Map === "function" ? new Map() : undefined;

  _wrapNativeSuper = function _wrapNativeSuper(Class) {
    if (Class === null || !_isNativeFunction(Class)) return Class;

    if (typeof Class !== "function") {
      throw new TypeError("Super expression must either be null or a function");
    }

    if (typeof _cache !== "undefined") {
      if (_cache.has(Class)) return _cache.get(Class);

      _cache.set(Class, Wrapper);
    }

    function Wrapper() {
      return _construct(Class, arguments, _getPrototypeOf(this).constructor);
    }

    Wrapper.prototype = Object.create(Class.prototype, {
      constructor: {
        value: Wrapper,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    return _setPrototypeOf(Wrapper, Class);
  };

  return _wrapNativeSuper(Class);
}

function _assertThisInitialized(self) {
  if (self === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return self;
}

function _possibleConstructorReturn(self, call) {
  if (call && (typeof call === "object" || typeof call === "function")) {
    return call;
  } else if (call !== void 0) {
    throw new TypeError("Derived constructors may only return object or undefined");
  }

  return _assertThisInitialized(self);
}

function _createSuper(Derived) {
  var hasNativeReflectConstruct = _isNativeReflectConstruct();

  return function _createSuperInternal() {
    var Super = _getPrototypeOf(Derived),
        result;

    if (hasNativeReflectConstruct) {
      var NewTarget = _getPrototypeOf(this).constructor;

      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }

    return _possibleConstructorReturn(this, result);
  };
}

function _superPropBase(object, property) {
  while (!Object.prototype.hasOwnProperty.call(object, property)) {
    object = _getPrototypeOf(object);
    if (object === null) break;
  }

  return object;
}

function _get() {
  if (typeof Reflect !== "undefined" && Reflect.get) {
    _get = Reflect.get;
  } else {
    _get = function _get(target, property, receiver) {
      var base = _superPropBase(target, property);

      if (!base) return;
      var desc = Object.getOwnPropertyDescriptor(base, property);

      if (desc.get) {
        return desc.get.call(arguments.length < 3 ? target : receiver);
      }

      return desc.value;
    };
  }

  return _get.apply(this, arguments);
}

function _slicedToArray(arr, i) {
  return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
}

function _toConsumableArray(arr) {
  return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
}

function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) return _arrayLikeToArray(arr);
}

function _arrayWithHoles(arr) {
  if (Array.isArray(arr)) return arr;
}

function _iterableToArray(iter) {
  if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
}

function _iterableToArrayLimit(arr, i) {
  var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];

  if (_i == null) return;
  var _arr = [];
  var _n = true;
  var _d = false;

  var _s, _e;

  try {
    for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) {
      _arr.push(_s.value);

      if (i && _arr.length === i) break;
    }
  } catch (err) {
    _d = true;
    _e = err;
  } finally {
    try {
      if (!_n && _i["return"] != null) _i["return"]();
    } finally {
      if (_d) throw _e;
    }
  }

  return _arr;
}

function _unsupportedIterableToArray(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return _arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
}

function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;

  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

  return arr2;
}

function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

function _createForOfIteratorHelper(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];

  if (!it) {
    if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
      if (it) o = it;
      var i = 0;

      var F = function () {};

      return {
        s: F,
        n: function () {
          if (i >= o.length) return {
            done: true
          };
          return {
            done: false,
            value: o[i++]
          };
        },
        e: function (e) {
          throw e;
        },
        f: F
      };
    }

    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  var normalCompletion = true,
      didErr = false,
      err;
  return {
    s: function () {
      it = it.call(o);
    },
    n: function () {
      var step = it.next();
      normalCompletion = step.done;
      return step;
    },
    e: function (e) {
      didErr = true;
      err = e;
    },
    f: function () {
      try {
        if (!normalCompletion && it.return != null) it.return();
      } finally {
        if (didErr) throw err;
      }
    }
  };
}

/*! pako 2.0.4 https://github.com/nodeca/pako @license (MIT AND Zlib) */
// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

/* eslint-disable space-unary-ops */

/* Public constants ==========================================================*/
/* ===========================================================================*/


//const Z_FILTERED          = 1;
//const Z_HUFFMAN_ONLY      = 2;
//const Z_RLE               = 3;
const Z_FIXED$1               = 4;
//const Z_DEFAULT_STRATEGY  = 0;

/* Possible values of the data_type field (though see inflate()) */
const Z_BINARY              = 0;
const Z_TEXT                = 1;
//const Z_ASCII             = 1; // = Z_TEXT
const Z_UNKNOWN$1             = 2;

/*============================================================================*/


function zero$1(buf) { let len = buf.length; while (--len >= 0) { buf[len] = 0; } }

// From zutil.h

const STORED_BLOCK = 0;
const STATIC_TREES = 1;
const DYN_TREES    = 2;
/* The three kinds of block type */

const MIN_MATCH$1    = 3;
const MAX_MATCH$1    = 258;
/* The minimum and maximum match lengths */

// From deflate.h
/* ===========================================================================
 * Internal compression state.
 */

const LENGTH_CODES$1  = 29;
/* number of length codes, not counting the special END_BLOCK code */

const LITERALS$1      = 256;
/* number of literal bytes 0..255 */

const L_CODES$1       = LITERALS$1 + 1 + LENGTH_CODES$1;
/* number of Literal or Length codes, including the END_BLOCK code */

const D_CODES$1       = 30;
/* number of distance codes */

const BL_CODES$1      = 19;
/* number of codes used to transfer the bit lengths */

const HEAP_SIZE$1     = 2 * L_CODES$1 + 1;
/* maximum heap size */

const MAX_BITS$1      = 15;
/* All codes must not exceed MAX_BITS bits */

const Buf_size      = 16;
/* size of bit buffer in bi_buf */


/* ===========================================================================
 * Constants
 */

const MAX_BL_BITS = 7;
/* Bit length codes must not exceed MAX_BL_BITS bits */

const END_BLOCK   = 256;
/* end of block literal code */

const REP_3_6     = 16;
/* repeat previous bit length 3-6 times (2 bits of repeat count) */

const REPZ_3_10   = 17;
/* repeat a zero length 3-10 times  (3 bits of repeat count) */

const REPZ_11_138 = 18;
/* repeat a zero length 11-138 times  (7 bits of repeat count) */

/* eslint-disable comma-spacing,array-bracket-spacing */
const extra_lbits =   /* extra bits for each length code */
  new Uint8Array([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0]);

const extra_dbits =   /* extra bits for each distance code */
  new Uint8Array([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13]);

const extra_blbits =  /* extra bits for each bit length code */
  new Uint8Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7]);

const bl_order =
  new Uint8Array([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]);
/* eslint-enable comma-spacing,array-bracket-spacing */

/* The lengths of the bit length codes are sent in order of decreasing
 * probability, to avoid transmitting the lengths for unused bit length codes.
 */

/* ===========================================================================
 * Local data. These are initialized only once.
 */

// We pre-fill arrays with 0 to avoid uninitialized gaps

const DIST_CODE_LEN = 512; /* see definition of array dist_code below */

// !!!! Use flat array instead of structure, Freq = i*2, Len = i*2+1
const static_ltree  = new Array((L_CODES$1 + 2) * 2);
zero$1(static_ltree);
/* The static literal tree. Since the bit lengths are imposed, there is no
 * need for the L_CODES extra codes used during heap construction. However
 * The codes 286 and 287 are needed to build a canonical tree (see _tr_init
 * below).
 */

const static_dtree  = new Array(D_CODES$1 * 2);
zero$1(static_dtree);
/* The static distance tree. (Actually a trivial tree since all codes use
 * 5 bits.)
 */

const _dist_code    = new Array(DIST_CODE_LEN);
zero$1(_dist_code);
/* Distance codes. The first 256 values correspond to the distances
 * 3 .. 258, the last 256 values correspond to the top 8 bits of
 * the 15 bit distances.
 */

const _length_code  = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
zero$1(_length_code);
/* length code for each normalized match length (0 == MIN_MATCH) */

const base_length   = new Array(LENGTH_CODES$1);
zero$1(base_length);
/* First normalized length for each code (0 = MIN_MATCH) */

const base_dist     = new Array(D_CODES$1);
zero$1(base_dist);
/* First normalized distance for each code (0 = distance of 1) */


function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {

  this.static_tree  = static_tree;  /* static tree or NULL */
  this.extra_bits   = extra_bits;   /* extra bits for each code or NULL */
  this.extra_base   = extra_base;   /* base index for extra_bits */
  this.elems        = elems;        /* max number of elements in the tree */
  this.max_length   = max_length;   /* max bit length for the codes */

  // show if `static_tree` has data or dummy - needed for monomorphic objects
  this.has_stree    = static_tree && static_tree.length;
}


let static_l_desc;
let static_d_desc;
let static_bl_desc;


function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;     /* the dynamic tree */
  this.max_code = 0;            /* largest code with non zero frequency */
  this.stat_desc = stat_desc;   /* the corresponding static tree */
}



const d_code = (dist) => {

  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
};


/* ===========================================================================
 * Output a short LSB first on the stream.
 * IN assertion: there is enough room in pendingBuf.
 */
const put_short = (s, w) => {
//    put_byte(s, (uch)((w) & 0xff));
//    put_byte(s, (uch)((ush)(w) >> 8));
  s.pending_buf[s.pending++] = (w) & 0xff;
  s.pending_buf[s.pending++] = (w >>> 8) & 0xff;
};


/* ===========================================================================
 * Send a value on a given number of bits.
 * IN assertion: length <= 16 and value fits in length bits.
 */
const send_bits = (s, value, length) => {

  if (s.bi_valid > (Buf_size - length)) {
    s.bi_buf |= (value << s.bi_valid) & 0xffff;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> (Buf_size - s.bi_valid);
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= (value << s.bi_valid) & 0xffff;
    s.bi_valid += length;
  }
};


const send_code = (s, c, tree) => {

  send_bits(s, tree[c * 2]/*.Code*/, tree[c * 2 + 1]/*.Len*/);
};


/* ===========================================================================
 * Reverse the first len bits of a code, using straightforward code (a faster
 * method would use a table)
 * IN assertion: 1 <= len <= 15
 */
const bi_reverse = (code, len) => {

  let res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
};


/* ===========================================================================
 * Flush the bit buffer, keeping at most 7 bits in it.
 */
const bi_flush = (s) => {

  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;

  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 0xff;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
};


/* ===========================================================================
 * Compute the optimal bit lengths for a tree and update the total bit length
 * for the current block.
 * IN assertion: the fields freq and dad are set, heap[heap_max] and
 *    above are the tree nodes sorted by increasing frequency.
 * OUT assertions: the field len is set to the optimal bit length, the
 *     array bl_count contains the frequencies for each bit length.
 *     The length opt_len is updated; static_len is also updated if stree is
 *     not null.
 */
const gen_bitlen = (s, desc) =>
//    deflate_state *s;
//    tree_desc *desc;    /* the tree descriptor */
{
  const tree            = desc.dyn_tree;
  const max_code        = desc.max_code;
  const stree           = desc.stat_desc.static_tree;
  const has_stree       = desc.stat_desc.has_stree;
  const extra           = desc.stat_desc.extra_bits;
  const base            = desc.stat_desc.extra_base;
  const max_length      = desc.stat_desc.max_length;
  let h;              /* heap index */
  let n, m;           /* iterate over the tree elements */
  let bits;           /* bit length */
  let xbits;          /* extra bits */
  let f;              /* frequency */
  let overflow = 0;   /* number of elements with bit length too large */

  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    s.bl_count[bits] = 0;
  }

  /* In a first pass, compute the optimal bit lengths (which may
   * overflow in the case of the bit length tree).
   */
  tree[s.heap[s.heap_max] * 2 + 1]/*.Len*/ = 0; /* root of the heap */

  for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1]/*.Dad*/ * 2 + 1]/*.Len*/ + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1]/*.Len*/ = bits;
    /* We overwrite tree[n].Dad which is no longer needed */

    if (n > max_code) { continue; } /* not a leaf node */

    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n - base];
    }
    f = tree[n * 2]/*.Freq*/;
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n * 2 + 1]/*.Len*/ + xbits);
    }
  }
  if (overflow === 0) { return; }

  // Trace((stderr,"\nbit length overflow\n"));
  /* This happens for example on obj2 and pic of the Calgary corpus */

  /* Find the first bit length which could increase: */
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0) { bits--; }
    s.bl_count[bits]--;      /* move one leaf down the tree */
    s.bl_count[bits + 1] += 2; /* move one overflow item as its brother */
    s.bl_count[max_length]--;
    /* The brother of the overflow item also moves one step up,
     * but this does not affect bl_count[max_length]
     */
    overflow -= 2;
  } while (overflow > 0);

  /* Now recompute all bit lengths, scanning in increasing frequency.
   * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
   * lengths instead of fixing only the wrong ones. This idea is taken
   * from 'ar' written by Haruhiko Okumura.)
   */
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) { continue; }
      if (tree[m * 2 + 1]/*.Len*/ !== bits) {
        // Trace((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
        s.opt_len += (bits - tree[m * 2 + 1]/*.Len*/) * tree[m * 2]/*.Freq*/;
        tree[m * 2 + 1]/*.Len*/ = bits;
      }
      n--;
    }
  }
};


/* ===========================================================================
 * Generate the codes for a given tree and bit counts (which need not be
 * optimal).
 * IN assertion: the array bl_count contains the bit length statistics for
 * the given tree and the field len is set for all tree elements.
 * OUT assertion: the field code is set for all tree elements of non
 *     zero code length.
 */
const gen_codes = (tree, max_code, bl_count) =>
//    ct_data *tree;             /* the tree to decorate */
//    int max_code;              /* largest code with non zero frequency */
//    ushf *bl_count;            /* number of codes at each bit length */
{
  const next_code = new Array(MAX_BITS$1 + 1); /* next code value for each bit length */
  let code = 0;              /* running code value */
  let bits;                  /* bit index */
  let n;                     /* code index */

  /* The distribution counts are first used to generate the code values
   * without bit reversal.
   */
  for (bits = 1; bits <= MAX_BITS$1; bits++) {
    next_code[bits] = code = (code + bl_count[bits - 1]) << 1;
  }
  /* Check that the bit counts in bl_count are consistent. The last code
   * must be all ones.
   */
  //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
  //        "inconsistent bit counts");
  //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

  for (n = 0;  n <= max_code; n++) {
    let len = tree[n * 2 + 1]/*.Len*/;
    if (len === 0) { continue; }
    /* Now reverse the bits */
    tree[n * 2]/*.Code*/ = bi_reverse(next_code[len]++, len);

    //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
    //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
  }
};


/* ===========================================================================
 * Initialize the various 'constant' tables.
 */
const tr_static_init = () => {

  let n;        /* iterates over tree elements */
  let bits;     /* bit counter */
  let length;   /* length value */
  let code;     /* code value */
  let dist;     /* distance index */
  const bl_count = new Array(MAX_BITS$1 + 1);
  /* number of codes at each bit length for an optimal tree */

  // do check in _tr_init()
  //if (static_init_done) return;

  /* For some embedded targets, global variables are not initialized: */
/*#ifdef NO_INIT_GLOBAL_POINTERS
  static_l_desc.static_tree = static_ltree;
  static_l_desc.extra_bits = extra_lbits;
  static_d_desc.static_tree = static_dtree;
  static_d_desc.extra_bits = extra_dbits;
  static_bl_desc.extra_bits = extra_blbits;
#endif*/

  /* Initialize the mapping length (0..255) -> length code (0..28) */
  length = 0;
  for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
    base_length[code] = length;
    for (n = 0; n < (1 << extra_lbits[code]); n++) {
      _length_code[length++] = code;
    }
  }
  //Assert (length == 256, "tr_static_init: length != 256");
  /* Note that the length 255 (match length 258) can be represented
   * in two different ways: code 284 + 5 bits or code 285, so we
   * overwrite length_code[255] to use the best encoding:
   */
  _length_code[length - 1] = code;

  /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < (1 << extra_dbits[code]); n++) {
      _dist_code[dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: dist != 256");
  dist >>= 7; /* from now on, all distances are divided by 128 */
  for (; code < D_CODES$1; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < (1 << (extra_dbits[code] - 7)); n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: 256+dist != 512");

  /* Construct the codes of the static literal tree */
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    bl_count[bits] = 0;
  }

  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1]/*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1]/*.Len*/ = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1]/*.Len*/ = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1]/*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  /* Codes 286 and 287 do not exist, but we must include them in the
   * tree construction to get a canonical Huffman tree (longest code
   * all ones)
   */
  gen_codes(static_ltree, L_CODES$1 + 1, bl_count);

  /* The static distance tree is trivial: */
  for (n = 0; n < D_CODES$1; n++) {
    static_dtree[n * 2 + 1]/*.Len*/ = 5;
    static_dtree[n * 2]/*.Code*/ = bi_reverse(n, 5);
  }

  // Now data ready and we can init static trees
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0,          D_CODES$1, MAX_BITS$1);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0,         BL_CODES$1, MAX_BL_BITS);

  //static_init_done = true;
};


/* ===========================================================================
 * Initialize a new block.
 */
const init_block = (s) => {

  let n; /* iterates over tree elements */

  /* Initialize the trees. */
  for (n = 0; n < L_CODES$1;  n++) { s.dyn_ltree[n * 2]/*.Freq*/ = 0; }
  for (n = 0; n < D_CODES$1;  n++) { s.dyn_dtree[n * 2]/*.Freq*/ = 0; }
  for (n = 0; n < BL_CODES$1; n++) { s.bl_tree[n * 2]/*.Freq*/ = 0; }

  s.dyn_ltree[END_BLOCK * 2]/*.Freq*/ = 1;
  s.opt_len = s.static_len = 0;
  s.last_lit = s.matches = 0;
};


/* ===========================================================================
 * Flush the bit buffer and align the output on a byte boundary
 */
const bi_windup = (s) =>
{
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    //put_byte(s, (Byte)s->bi_buf);
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
};

/* ===========================================================================
 * Copy a stored block, storing first the length and its
 * one's complement if requested.
 */
const copy_block = (s, buf, len, header) =>
//DeflateState *s;
//charf    *buf;    /* the input data */
//unsigned len;     /* its length */
//int      header;  /* true if block header must be written */
{
  bi_windup(s);        /* align on byte boundary */

  if (header) {
    put_short(s, len);
    put_short(s, ~len);
  }
//  while (len--) {
//    put_byte(s, *buf++);
//  }
  s.pending_buf.set(s.window.subarray(buf, buf + len), s.pending);
  s.pending += len;
};

/* ===========================================================================
 * Compares to subtrees, using the tree depth as tie breaker when
 * the subtrees have equal frequency. This minimizes the worst case length.
 */
const smaller = (tree, n, m, depth) => {

  const _n2 = n * 2;
  const _m2 = m * 2;
  return (tree[_n2]/*.Freq*/ < tree[_m2]/*.Freq*/ ||
         (tree[_n2]/*.Freq*/ === tree[_m2]/*.Freq*/ && depth[n] <= depth[m]));
};

/* ===========================================================================
 * Restore the heap property by moving down the tree starting at node k,
 * exchanging a node with the smallest of its two sons if necessary, stopping
 * when the heap property is re-established (each father smaller than its
 * two sons).
 */
const pqdownheap = (s, tree, k) =>
//    deflate_state *s;
//    ct_data *tree;  /* the tree to restore */
//    int k;               /* node to move down */
{
  const v = s.heap[k];
  let j = k << 1;  /* left son of k */
  while (j <= s.heap_len) {
    /* Set j to the smallest of the two sons: */
    if (j < s.heap_len &&
      smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
      j++;
    }
    /* Exit if v is smaller than both sons */
    if (smaller(tree, v, s.heap[j], s.depth)) { break; }

    /* Exchange v with the smallest son */
    s.heap[k] = s.heap[j];
    k = j;

    /* And continue down the tree, setting j to the left son of k */
    j <<= 1;
  }
  s.heap[k] = v;
};


// inlined manually
// const SMALLEST = 1;

/* ===========================================================================
 * Send the block data compressed using the given Huffman trees
 */
const compress_block = (s, ltree, dtree) =>
//    deflate_state *s;
//    const ct_data *ltree; /* literal tree */
//    const ct_data *dtree; /* distance tree */
{
  let dist;           /* distance of matched string */
  let lc;             /* match length or unmatched char (if dist == 0) */
  let lx = 0;         /* running index in l_buf */
  let code;           /* the code to send */
  let extra;          /* number of extra bits to send */

  if (s.last_lit !== 0) {
    do {
      dist = (s.pending_buf[s.d_buf + lx * 2] << 8) | (s.pending_buf[s.d_buf + lx * 2 + 1]);
      lc = s.pending_buf[s.l_buf + lx];
      lx++;

      if (dist === 0) {
        send_code(s, lc, ltree); /* send a literal byte */
        //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
      } else {
        /* Here, lc is the match length - MIN_MATCH */
        code = _length_code[lc];
        send_code(s, code + LITERALS$1 + 1, ltree); /* send the length code */
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);       /* send the extra length bits */
        }
        dist--; /* dist is now the match distance - 1 */
        code = d_code(dist);
        //Assert (code < D_CODES, "bad d_code");

        send_code(s, code, dtree);       /* send the distance code */
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);   /* send the extra distance bits */
        }
      } /* literal or match pair ? */

      /* Check that the overlay between pending_buf and d_buf+l_buf is ok: */
      //Assert((uInt)(s->pending) < s->lit_bufsize + 2*lx,
      //       "pendingBuf overflow");

    } while (lx < s.last_lit);
  }

  send_code(s, END_BLOCK, ltree);
};


/* ===========================================================================
 * Construct one Huffman tree and assigns the code bit strings and lengths.
 * Update the total bit length for the current block.
 * IN assertion: the field freq is set for all tree elements.
 * OUT assertions: the fields len and code are set to the optimal bit length
 *     and corresponding code. The length opt_len is updated; static_len is
 *     also updated if stree is not null. The field max_code is set.
 */
const build_tree = (s, desc) =>
//    deflate_state *s;
//    tree_desc *desc; /* the tree descriptor */
{
  const tree     = desc.dyn_tree;
  const stree    = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const elems    = desc.stat_desc.elems;
  let n, m;          /* iterate over heap elements */
  let max_code = -1; /* largest code with non zero frequency */
  let node;          /* new node being created */

  /* Construct the initial heap, with least frequent element in
   * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
   * heap[0] is not used.
   */
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE$1;

  for (n = 0; n < elems; n++) {
    if (tree[n * 2]/*.Freq*/ !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;

    } else {
      tree[n * 2 + 1]/*.Len*/ = 0;
    }
  }

  /* The pkzip format requires that at least one distance code exists,
   * and that at least one bit should be sent even if there is only one
   * possible code. So to avoid special checks later on we force at least
   * two codes of non zero frequency.
   */
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = (max_code < 2 ? ++max_code : 0);
    tree[node * 2]/*.Freq*/ = 1;
    s.depth[node] = 0;
    s.opt_len--;

    if (has_stree) {
      s.static_len -= stree[node * 2 + 1]/*.Len*/;
    }
    /* node is 0 or 1 so it does not have extra bits */
  }
  desc.max_code = max_code;

  /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
   * establish sub-heaps of increasing lengths:
   */
  for (n = (s.heap_len >> 1/*int /2*/); n >= 1; n--) { pqdownheap(s, tree, n); }

  /* Construct the Huffman tree by repeatedly combining the least two
   * frequent nodes.
   */
  node = elems;              /* next internal node of the tree */
  do {
    //pqremove(s, tree, n);  /* n = node of least frequency */
    /*** pqremove ***/
    n = s.heap[1/*SMALLEST*/];
    s.heap[1/*SMALLEST*/] = s.heap[s.heap_len--];
    pqdownheap(s, tree, 1/*SMALLEST*/);
    /***/

    m = s.heap[1/*SMALLEST*/]; /* m = node of next least frequency */

    s.heap[--s.heap_max] = n; /* keep the nodes sorted by frequency */
    s.heap[--s.heap_max] = m;

    /* Create a new node father of n and m */
    tree[node * 2]/*.Freq*/ = tree[n * 2]/*.Freq*/ + tree[m * 2]/*.Freq*/;
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1]/*.Dad*/ = tree[m * 2 + 1]/*.Dad*/ = node;

    /* and insert the new node in the heap */
    s.heap[1/*SMALLEST*/] = node++;
    pqdownheap(s, tree, 1/*SMALLEST*/);

  } while (s.heap_len >= 2);

  s.heap[--s.heap_max] = s.heap[1/*SMALLEST*/];

  /* At this point, the fields freq and dad are set. We can now
   * generate the bit lengths.
   */
  gen_bitlen(s, desc);

  /* The field len is now set, we can generate the bit codes */
  gen_codes(tree, max_code, s.bl_count);
};


/* ===========================================================================
 * Scan a literal or distance tree to determine the frequencies of the codes
 * in the bit length tree.
 */
const scan_tree = (s, tree, max_code) =>
//    deflate_state *s;
//    ct_data *tree;   /* the tree to be scanned */
//    int max_code;    /* and its largest code of non zero frequency */
{
  let n;                     /* iterates over all tree elements */
  let prevlen = -1;          /* last emitted length */
  let curlen;                /* length of current code */

  let nextlen = tree[0 * 2 + 1]/*.Len*/; /* length of next code */

  let count = 0;             /* repeat count of the current code */
  let max_count = 7;         /* max repeat count */
  let min_count = 4;         /* min repeat count */

  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1]/*.Len*/ = 0xffff; /* guard */

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1]/*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;

    } else if (count < min_count) {
      s.bl_tree[curlen * 2]/*.Freq*/ += count;

    } else if (curlen !== 0) {

      if (curlen !== prevlen) { s.bl_tree[curlen * 2]/*.Freq*/++; }
      s.bl_tree[REP_3_6 * 2]/*.Freq*/++;

    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10 * 2]/*.Freq*/++;

    } else {
      s.bl_tree[REPZ_11_138 * 2]/*.Freq*/++;
    }

    count = 0;
    prevlen = curlen;

    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;

    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;

    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};


/* ===========================================================================
 * Send a literal or distance tree in compressed form, using the codes in
 * bl_tree.
 */
const send_tree = (s, tree, max_code) =>
//    deflate_state *s;
//    ct_data *tree; /* the tree to be scanned */
//    int max_code;       /* and its largest code of non zero frequency */
{
  let n;                     /* iterates over all tree elements */
  let prevlen = -1;          /* last emitted length */
  let curlen;                /* length of current code */

  let nextlen = tree[0 * 2 + 1]/*.Len*/; /* length of next code */

  let count = 0;             /* repeat count of the current code */
  let max_count = 7;         /* max repeat count */
  let min_count = 4;         /* min repeat count */

  /* tree[max_code+1].Len = -1; */  /* guard already set */
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1]/*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;

    } else if (count < min_count) {
      do { send_code(s, curlen, s.bl_tree); } while (--count !== 0);

    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      //Assert(count >= 3 && count <= 6, " 3_6?");
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);

    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);

    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }

    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;

    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;

    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};


/* ===========================================================================
 * Construct the Huffman tree for the bit lengths and return the index in
 * bl_order of the last bit length code to send.
 */
const build_bl_tree = (s) => {

  let max_blindex;  /* index of last bit length code of non zero freq */

  /* Determine the bit length frequencies for literal and distance trees */
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);

  /* Build the bit length tree: */
  build_tree(s, s.bl_desc);
  /* opt_len now includes the length of the tree representations, except
   * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
   */

  /* Determine the number of bit length codes to send. The pkzip format
   * requires that at least 4 bit length codes be sent. (appnote.txt says
   * 3 but the actual value used is 4.)
   */
  for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1]/*.Len*/ !== 0) {
      break;
    }
  }
  /* Update opt_len to include the bit length tree and counts */
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
  //        s->opt_len, s->static_len));

  return max_blindex;
};


/* ===========================================================================
 * Send the header for a block using dynamic Huffman trees: the counts, the
 * lengths of the bit length codes, the literal tree and the distance tree.
 * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
 */
const send_all_trees = (s, lcodes, dcodes, blcodes) =>
//    deflate_state *s;
//    int lcodes, dcodes, blcodes; /* number of codes for each tree */
{
  let rank;                    /* index in bl_order */

  //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
  //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
  //        "too many codes");
  //Tracev((stderr, "\nbl counts: "));
  send_bits(s, lcodes - 257, 5); /* not +255 as stated in appnote.txt */
  send_bits(s, dcodes - 1,   5);
  send_bits(s, blcodes - 4,  4); /* not -3 as stated in appnote.txt */
  for (rank = 0; rank < blcodes; rank++) {
    //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
    send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1]/*.Len*/, 3);
  }
  //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_ltree, lcodes - 1); /* literal tree */
  //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_dtree, dcodes - 1); /* distance tree */
  //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
};


/* ===========================================================================
 * Check if the data type is TEXT or BINARY, using the following algorithm:
 * - TEXT if the two conditions below are satisfied:
 *    a) There are no non-portable control characters belonging to the
 *       "black list" (0..6, 14..25, 28..31).
 *    b) There is at least one printable character belonging to the
 *       "white list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
 * - BINARY otherwise.
 * - The following partially-portable control characters form a
 *   "gray list" that is ignored in this detection algorithm:
 *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
 * IN assertion: the fields Freq of dyn_ltree are set.
 */
const detect_data_type = (s) => {
  /* black_mask is the bit mask of black-listed bytes
   * set bits 0..6, 14..25, and 28..31
   * 0xf3ffc07f = binary 11110011111111111100000001111111
   */
  let black_mask = 0xf3ffc07f;
  let n;

  /* Check for non-textual ("black-listed") bytes. */
  for (n = 0; n <= 31; n++, black_mask >>>= 1) {
    if ((black_mask & 1) && (s.dyn_ltree[n * 2]/*.Freq*/ !== 0)) {
      return Z_BINARY;
    }
  }

  /* Check for textual ("white-listed") bytes. */
  if (s.dyn_ltree[9 * 2]/*.Freq*/ !== 0 || s.dyn_ltree[10 * 2]/*.Freq*/ !== 0 ||
      s.dyn_ltree[13 * 2]/*.Freq*/ !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS$1; n++) {
    if (s.dyn_ltree[n * 2]/*.Freq*/ !== 0) {
      return Z_TEXT;
    }
  }

  /* There are no "black-listed" or "white-listed" bytes:
   * this stream either is empty or has tolerated ("gray-listed") bytes only.
   */
  return Z_BINARY;
};


let static_init_done = false;

/* ===========================================================================
 * Initialize the tree data structures for a new zlib stream.
 */
const _tr_init$1 = (s) =>
{

  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }

  s.l_desc  = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc  = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);

  s.bi_buf = 0;
  s.bi_valid = 0;

  /* Initialize the first block of the first file: */
  init_block(s);
};


/* ===========================================================================
 * Send a stored block
 */
const _tr_stored_block$1 = (s, buf, stored_len, last) =>
//DeflateState *s;
//charf *buf;       /* input block */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */
{
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);    /* send block type */
  copy_block(s, buf, stored_len, true); /* with header */
};


/* ===========================================================================
 * Send one empty static block to give enough lookahead for inflate.
 * This takes 10 bits, of which 7 may remain in the bit buffer.
 */
const _tr_align$1 = (s) => {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
};


/* ===========================================================================
 * Determine the best encoding for the current block: dynamic trees, static
 * trees or store, and output the encoded block to the zip file.
 */
const _tr_flush_block$1 = (s, buf, stored_len, last) =>
//DeflateState *s;
//charf *buf;       /* input block, or NULL if too old */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */
{
  let opt_lenb, static_lenb;  /* opt_len and static_len in bytes */
  let max_blindex = 0;        /* index of last bit length code of non zero freq */

  /* Build the Huffman trees unless a stored block is forced */
  if (s.level > 0) {

    /* Check if the file is binary or text */
    if (s.strm.data_type === Z_UNKNOWN$1) {
      s.strm.data_type = detect_data_type(s);
    }

    /* Construct the literal and distance trees */
    build_tree(s, s.l_desc);
    // Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));

    build_tree(s, s.d_desc);
    // Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));
    /* At this point, opt_len and static_len are the total bit lengths of
     * the compressed block data, excluding the tree representations.
     */

    /* Build the bit length tree for the above two trees, and get the index
     * in bl_order of the last bit length code to send.
     */
    max_blindex = build_bl_tree(s);

    /* Determine the best encoding. Compute the block lengths in bytes. */
    opt_lenb = (s.opt_len + 3 + 7) >>> 3;
    static_lenb = (s.static_len + 3 + 7) >>> 3;

    // Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
    //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
    //        s->last_lit));

    if (static_lenb <= opt_lenb) { opt_lenb = static_lenb; }

  } else {
    // Assert(buf != (char*)0, "lost buf");
    opt_lenb = static_lenb = stored_len + 5; /* force a stored block */
  }

  if ((stored_len + 4 <= opt_lenb) && (buf !== -1)) {
    /* 4: two words for the lengths */

    /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
     * Otherwise we can't have processed more than WSIZE input bytes since
     * the last block flush, because compression would have been
     * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
     * transform a block into a stored block.
     */
    _tr_stored_block$1(s, buf, stored_len, last);

  } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {

    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);

  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  // Assert (s->compressed_len == s->bits_sent, "bad compressed size");
  /* The above check is made mod 2^32, for files larger than 512 MB
   * and uLong implemented on 32 bits.
   */
  init_block(s);

  if (last) {
    bi_windup(s);
  }
  // Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
  //       s->compressed_len-7*last));
};

/* ===========================================================================
 * Save the match info and tally the frequency counts. Return true if
 * the current block must be flushed.
 */
const _tr_tally$1 = (s, dist, lc) =>
//    deflate_state *s;
//    unsigned dist;  /* distance of matched string */
//    unsigned lc;    /* match length-MIN_MATCH or unmatched char (if dist==0) */
{
  //let out_length, in_length, dcode;

  s.pending_buf[s.d_buf + s.last_lit * 2]     = (dist >>> 8) & 0xff;
  s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 0xff;

  s.pending_buf[s.l_buf + s.last_lit] = lc & 0xff;
  s.last_lit++;

  if (dist === 0) {
    /* lc is the unmatched char */
    s.dyn_ltree[lc * 2]/*.Freq*/++;
  } else {
    s.matches++;
    /* Here, lc is the match length - MIN_MATCH */
    dist--;             /* dist = match distance - 1 */
    //Assert((ush)dist < (ush)MAX_DIST(s) &&
    //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
    //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

    s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2]/*.Freq*/++;
    s.dyn_dtree[d_code(dist) * 2]/*.Freq*/++;
  }

// (!) This block is disabled in zlib defaults,
// don't enable it for binary compatibility

//#ifdef TRUNCATE_BLOCK
//  /* Try to guess if it is profitable to stop the current block here */
//  if ((s.last_lit & 0x1fff) === 0 && s.level > 2) {
//    /* Compute an upper bound for the compressed length */
//    out_length = s.last_lit*8;
//    in_length = s.strstart - s.block_start;
//
//    for (dcode = 0; dcode < D_CODES; dcode++) {
//      out_length += s.dyn_dtree[dcode*2]/*.Freq*/ * (5 + extra_dbits[dcode]);
//    }
//    out_length >>>= 3;
//    //Tracev((stderr,"\nlast_lit %u, in %ld, out ~%ld(%ld%%) ",
//    //       s->last_lit, in_length, out_length,
//    //       100L - out_length*100L/in_length));
//    if (s.matches < (s.last_lit>>1)/*int /2*/ && out_length < (in_length>>1)/*int /2*/) {
//      return true;
//    }
//  }
//#endif

  return (s.last_lit === s.lit_bufsize - 1);
  /* We avoid equality with lit_bufsize because of wraparound at 64K
   * on 16 bit machines and because stored blocks are restricted to
   * 64K-1 bytes.
   */
};

var _tr_init_1  = _tr_init$1;
var _tr_stored_block_1 = _tr_stored_block$1;
var _tr_flush_block_1  = _tr_flush_block$1;
var _tr_tally_1 = _tr_tally$1;
var _tr_align_1 = _tr_align$1;

var trees = {
	_tr_init: _tr_init_1,
	_tr_stored_block: _tr_stored_block_1,
	_tr_flush_block: _tr_flush_block_1,
	_tr_tally: _tr_tally_1,
	_tr_align: _tr_align_1
};

// Note: adler32 takes 12% for level 0 and 2% for level 6.
// It isn't worth it to make additional optimizations as in original.
// Small size is preferable.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const adler32 = (adler, buf, len, pos) => {
  let s1 = (adler & 0xffff) |0,
      s2 = ((adler >>> 16) & 0xffff) |0,
      n = 0;

  while (len !== 0) {
    // Set limit ~ twice less than 5552, to keep
    // s2 in 31-bits, because we force signed ints.
    // in other case %= will fail.
    n = len > 2000 ? 2000 : len;
    len -= n;

    do {
      s1 = (s1 + buf[pos++]) |0;
      s2 = (s2 + s1) |0;
    } while (--n);

    s1 %= 65521;
    s2 %= 65521;
  }

  return (s1 | (s2 << 16)) |0;
};


var adler32_1 = adler32;

// Note: we can't get significant speed boost here.
// So write code to minimize size - no pregenerated tables
// and array tools dependencies.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// Use ordinary array, since untyped makes no boost here
const makeTable = () => {
  let c, table = [];

  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }

  return table;
};

// Create table on load. Just 255 signed longs. Not a problem.
const crcTable = new Uint32Array(makeTable());


const crc32 = (crc, buf, len, pos) => {
  const t = crcTable;
  const end = pos + len;

  crc ^= -1;

  for (let i = pos; i < end; i++) {
    crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
  }

  return (crc ^ (-1)); // >>> 0;
};


var crc32_1 = crc32;

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var messages = {
  2:      'need dictionary',     /* Z_NEED_DICT       2  */
  1:      'stream end',          /* Z_STREAM_END      1  */
  0:      '',                    /* Z_OK              0  */
  '-1':   'file error',          /* Z_ERRNO         (-1) */
  '-2':   'stream error',        /* Z_STREAM_ERROR  (-2) */
  '-3':   'data error',          /* Z_DATA_ERROR    (-3) */
  '-4':   'insufficient memory', /* Z_MEM_ERROR     (-4) */
  '-5':   'buffer error',        /* Z_BUF_ERROR     (-5) */
  '-6':   'incompatible version' /* Z_VERSION_ERROR (-6) */
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var constants$2 = {

  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH:         0,
  Z_PARTIAL_FLUSH:    1,
  Z_SYNC_FLUSH:       2,
  Z_FULL_FLUSH:       3,
  Z_FINISH:           4,
  Z_BLOCK:            5,
  Z_TREES:            6,

  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK:               0,
  Z_STREAM_END:       1,
  Z_NEED_DICT:        2,
  Z_ERRNO:           -1,
  Z_STREAM_ERROR:    -2,
  Z_DATA_ERROR:      -3,
  Z_MEM_ERROR:       -4,
  Z_BUF_ERROR:       -5,
  //Z_VERSION_ERROR: -6,

  /* compression levels */
  Z_NO_COMPRESSION:         0,
  Z_BEST_SPEED:             1,
  Z_BEST_COMPRESSION:       9,
  Z_DEFAULT_COMPRESSION:   -1,


  Z_FILTERED:               1,
  Z_HUFFMAN_ONLY:           2,
  Z_RLE:                    3,
  Z_FIXED:                  4,
  Z_DEFAULT_STRATEGY:       0,

  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY:                 0,
  Z_TEXT:                   1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN:                2,

  /* The deflate compression method */
  Z_DEFLATED:               8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const { _tr_init, _tr_stored_block, _tr_flush_block, _tr_tally, _tr_align } = trees;




/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
  Z_NO_FLUSH: Z_NO_FLUSH$2, Z_PARTIAL_FLUSH, Z_FULL_FLUSH: Z_FULL_FLUSH$1, Z_FINISH: Z_FINISH$3, Z_BLOCK: Z_BLOCK$1,
  Z_OK: Z_OK$3, Z_STREAM_END: Z_STREAM_END$3, Z_STREAM_ERROR: Z_STREAM_ERROR$2, Z_DATA_ERROR: Z_DATA_ERROR$2, Z_BUF_ERROR: Z_BUF_ERROR$1,
  Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION$1,
  Z_FILTERED, Z_HUFFMAN_ONLY, Z_RLE, Z_FIXED, Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY$1,
  Z_UNKNOWN,
  Z_DEFLATED: Z_DEFLATED$2
} = constants$2;

/*============================================================================*/


const MAX_MEM_LEVEL = 9;
/* Maximum value for memLevel in deflateInit2 */
const MAX_WBITS$1 = 15;
/* 32K LZ77 window */
const DEF_MEM_LEVEL = 8;


const LENGTH_CODES  = 29;
/* number of length codes, not counting the special END_BLOCK code */
const LITERALS      = 256;
/* number of literal bytes 0..255 */
const L_CODES       = LITERALS + 1 + LENGTH_CODES;
/* number of Literal or Length codes, including the END_BLOCK code */
const D_CODES       = 30;
/* number of distance codes */
const BL_CODES      = 19;
/* number of codes used to transfer the bit lengths */
const HEAP_SIZE     = 2 * L_CODES + 1;
/* maximum heap size */
const MAX_BITS  = 15;
/* All codes must not exceed MAX_BITS bits */

const MIN_MATCH = 3;
const MAX_MATCH = 258;
const MIN_LOOKAHEAD = (MAX_MATCH + MIN_MATCH + 1);

const PRESET_DICT = 0x20;

const INIT_STATE = 42;
const EXTRA_STATE = 69;
const NAME_STATE = 73;
const COMMENT_STATE = 91;
const HCRC_STATE = 103;
const BUSY_STATE = 113;
const FINISH_STATE = 666;

const BS_NEED_MORE      = 1; /* block not completed, need more input or more output */
const BS_BLOCK_DONE     = 2; /* block flush performed */
const BS_FINISH_STARTED = 3; /* finish started, need only more output at next deflate */
const BS_FINISH_DONE    = 4; /* finish done, accept no more input or output */

const OS_CODE = 0x03; // Unix :) . Don't detect, use this default.

const err = (strm, errorCode) => {
  strm.msg = messages[errorCode];
  return errorCode;
};

const rank = (f) => {
  return ((f) << 1) - ((f) > 4 ? 9 : 0);
};

const zero$2 = (buf) => {
  let len = buf.length; while (--len >= 0) { buf[len] = 0; }
};


/* eslint-disable new-cap */
let HASH_ZLIB = (s, prev, data) => ((prev << s.hash_shift) ^ data) & s.hash_mask;
// This hash causes less collisions, https://github.com/nodeca/pako/issues/135
// But breaks binary compatibility
//let HASH_FAST = (s, prev, data) => ((prev << 8) + (prev >> 8) + (data << 4)) & s.hash_mask;
let HASH = HASH_ZLIB;

/* =========================================================================
 * Flush as much pending output as possible. All deflate() output goes
 * through this function so some applications may wish to modify it
 * to avoid allocating a large strm->output buffer and copying into it.
 * (See also read_buf()).
 */
const flush_pending = (strm) => {
  const s = strm.state;

  //_tr_flush_bits(s);
  let len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) { return; }

  strm.output.set(s.pending_buf.subarray(s.pending_out, s.pending_out + len), strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
};


const flush_block_only = (s, last) => {
  _tr_flush_block(s, (s.block_start >= 0 ? s.block_start : -1), s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
};


const put_byte = (s, b) => {
  s.pending_buf[s.pending++] = b;
};


/* =========================================================================
 * Put a short in the pending buffer. The 16-bit value is put in MSB order.
 * IN assertion: the stream state is correct and there is enough room in
 * pending_buf.
 */
const putShortMSB = (s, b) => {

  //  put_byte(s, (Byte)(b >> 8));
//  put_byte(s, (Byte)(b & 0xff));
  s.pending_buf[s.pending++] = (b >>> 8) & 0xff;
  s.pending_buf[s.pending++] = b & 0xff;
};


/* ===========================================================================
 * Read a new buffer from the current input stream, update the adler32
 * and total number of bytes read.  All deflate() input goes through
 * this function so some applications may wish to modify it to avoid
 * allocating a large strm->input buffer and copying from it.
 * (See also flush_pending()).
 */
const read_buf = (strm, buf, start, size) => {

  let len = strm.avail_in;

  if (len > size) { len = size; }
  if (len === 0) { return 0; }

  strm.avail_in -= len;

  // zmemcpy(buf, strm->next_in, len);
  buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32_1(strm.adler, buf, len, start);
  }

  else if (strm.state.wrap === 2) {
    strm.adler = crc32_1(strm.adler, buf, len, start);
  }

  strm.next_in += len;
  strm.total_in += len;

  return len;
};


/* ===========================================================================
 * Set match_start to the longest match starting at the given string and
 * return its length. Matches shorter or equal to prev_length are discarded,
 * in which case the result is equal to prev_length and match_start is
 * garbage.
 * IN assertions: cur_match is the head of the hash chain for the current
 *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
 * OUT assertion: the match length is not greater than s->lookahead.
 */
const longest_match = (s, cur_match) => {

  let chain_length = s.max_chain_length;      /* max hash chain length */
  let scan = s.strstart; /* current string */
  let match;                       /* matched string */
  let len;                           /* length of current match */
  let best_len = s.prev_length;              /* best match length so far */
  let nice_match = s.nice_match;             /* stop if match long enough */
  const limit = (s.strstart > (s.w_size - MIN_LOOKAHEAD)) ?
      s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0/*NIL*/;

  const _win = s.window; // shortcut

  const wmask = s.w_mask;
  const prev  = s.prev;

  /* Stop when cur_match becomes <= limit. To simplify the code,
   * we prevent matches with the string of window index 0.
   */

  const strend = s.strstart + MAX_MATCH;
  let scan_end1  = _win[scan + best_len - 1];
  let scan_end   = _win[scan + best_len];

  /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
   * It is easy to get rid of this optimization if necessary.
   */
  // Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

  /* Do not waste too much time if we already have a good match: */
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  /* Do not look for matches beyond the end of the input. This is necessary
   * to make deflate deterministic.
   */
  if (nice_match > s.lookahead) { nice_match = s.lookahead; }

  // Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

  do {
    // Assert(cur_match < s->strstart, "no future");
    match = cur_match;

    /* Skip to next match if the match length cannot increase
     * or if the match length is less than 2.  Note that the checks below
     * for insufficient lookahead only occur occasionally for performance
     * reasons.  Therefore uninitialized memory will be accessed, and
     * conditional jumps will be made that depend on those values.
     * However the length of the match is limited to the lookahead, so
     * the output of deflate is not affected by the uninitialized values.
     */

    if (_win[match + best_len]     !== scan_end  ||
        _win[match + best_len - 1] !== scan_end1 ||
        _win[match]                !== _win[scan] ||
        _win[++match]              !== _win[scan + 1]) {
      continue;
    }

    /* The check at best_len-1 can be removed because it will be made
     * again later. (This heuristic is not always a win.)
     * It is not necessary to compare scan[2] and match[2] since they
     * are always equal when the other bytes match, given that
     * the hash keys are equal and that HASH_BITS >= 8.
     */
    scan += 2;
    match++;
    // Assert(*scan == *match, "match[2]?");

    /* We check for insufficient lookahead only every 8th comparison;
     * the 256th check will be made at strstart+258.
     */
    do {
      /*jshint noempty:false*/
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             scan < strend);

    // Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;

    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1  = _win[scan + best_len - 1];
      scan_end   = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);

  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
};


/* ===========================================================================
 * Fill the window when the lookahead becomes insufficient.
 * Updates strstart and lookahead.
 *
 * IN assertion: lookahead < MIN_LOOKAHEAD
 * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
 *    At least one byte has been read, or avail_in == 0; reads are
 *    performed for at least two bytes (required for the zip translate_eol
 *    option -- not supported here).
 */
const fill_window = (s) => {

  const _w_size = s.w_size;
  let p, n, m, more, str;

  //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

  do {
    more = s.window_size - s.lookahead - s.strstart;

    // JS ints have 32 bit, block below not needed
    /* Deal with !@#$% 64K limit: */
    //if (sizeof(int) <= 2) {
    //    if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
    //        more = wsize;
    //
    //  } else if (more == (unsigned)(-1)) {
    //        /* Very unlikely, but possible on 16 bit machine if
    //         * strstart == 0 && lookahead == 1 (input done a byte at time)
    //         */
    //        more--;
    //    }
    //}


    /* If the window is almost full and there is insufficient lookahead,
     * move the upper half to the lower one to make room in the upper half.
     */
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {

      s.window.set(s.window.subarray(_w_size, _w_size + _w_size), 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      /* we now have strstart >= MAX_DIST */
      s.block_start -= _w_size;

      /* Slide the hash table (could be avoided with 32 bit values
       at the expense of memory usage). We slide even when level == 0
       to keep the hash table consistent if we switch back to level > 0
       later. (Using level 0 permanently is not an optimal usage of
       zlib, so we don't care about this pathological case.)
       */

      n = s.hash_size;
      p = n;

      do {
        m = s.head[--p];
        s.head[p] = (m >= _w_size ? m - _w_size : 0);
      } while (--n);

      n = _w_size;
      p = n;

      do {
        m = s.prev[--p];
        s.prev[p] = (m >= _w_size ? m - _w_size : 0);
        /* If n is not on any hash chain, prev[n] is garbage but
         * its value will never be used.
         */
      } while (--n);

      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }

    /* If there was no sliding:
     *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
     *    more == window_size - lookahead - strstart
     * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
     * => more >= window_size - 2*WSIZE + 2
     * In the BIG_MEM or MMAP case (not yet supported),
     *   window_size == input_size + MIN_LOOKAHEAD  &&
     *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
     * Otherwise, window_size == 2*WSIZE so more >= 2.
     * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
     */
    //Assert(more >= 2, "more < 2");
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;

    /* Initialize the hash value now that we have some input: */
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];

      /* UPDATE_HASH(s, s->ins_h, s->window[str + 1]); */
      s.ins_h = HASH(s, s.ins_h, s.window[str + 1]);
//#if MIN_MATCH != 3
//        Call update_hash() MIN_MATCH-3 more times
//#endif
      while (s.insert) {
        /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
        s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);

        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
    /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
     * but this is not important since only literal bytes will be emitted.
     */

  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);

  /* If the WIN_INIT bytes after the end of the current data have never been
   * written, then zero those bytes in order to avoid memory check reports of
   * the use of uninitialized (or uninitialised as Julian writes) bytes by
   * the longest match routines.  Update the high water mark for the next
   * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
   * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
   */
//  if (s.high_water < s.window_size) {
//    const curr = s.strstart + s.lookahead;
//    let init = 0;
//
//    if (s.high_water < curr) {
//      /* Previous high water mark below current data -- zero WIN_INIT
//       * bytes or up to end of window, whichever is less.
//       */
//      init = s.window_size - curr;
//      if (init > WIN_INIT)
//        init = WIN_INIT;
//      zmemzero(s->window + curr, (unsigned)init);
//      s->high_water = curr + init;
//    }
//    else if (s->high_water < (ulg)curr + WIN_INIT) {
//      /* High water mark at or above current data, but below current data
//       * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
//       * to end of window, whichever is less.
//       */
//      init = (ulg)curr + WIN_INIT - s->high_water;
//      if (init > s->window_size - s->high_water)
//        init = s->window_size - s->high_water;
//      zmemzero(s->window + s->high_water, (unsigned)init);
//      s->high_water += init;
//    }
//  }
//
//  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
//    "not enough room for search");
};

/* ===========================================================================
 * Copy without compression as much as possible from the input stream, return
 * the current block state.
 * This function does not insert new strings in the dictionary since
 * uncompressible data is probably not useful. This function is used
 * only for the level=0 compression option.
 * NOTE: this function should be optimized to avoid extra copying from
 * window to pending_buf.
 */
const deflate_stored = (s, flush) => {

  /* Stored blocks are limited to 0xffff bytes, pending_buf is limited
   * to pending_buf_size, and each stored block has a 5 byte header:
   */
  let max_block_size = 0xffff;

  if (max_block_size > s.pending_buf_size - 5) {
    max_block_size = s.pending_buf_size - 5;
  }

  /* Copy as much as possible from input to output: */
  for (;;) {
    /* Fill the window as much as possible: */
    if (s.lookahead <= 1) {

      //Assert(s->strstart < s->w_size+MAX_DIST(s) ||
      //  s->block_start >= (long)s->w_size, "slide too late");
//      if (!(s.strstart < s.w_size + (s.w_size - MIN_LOOKAHEAD) ||
//        s.block_start >= s.w_size)) {
//        throw  new Error("slide too late");
//      }

      fill_window(s);
      if (s.lookahead === 0 && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }

      if (s.lookahead === 0) {
        break;
      }
      /* flush the current block */
    }
    //Assert(s->block_start >= 0L, "block gone");
//    if (s.block_start < 0) throw new Error("block gone");

    s.strstart += s.lookahead;
    s.lookahead = 0;

    /* Emit a stored block if pending_buf will be full: */
    const max_start = s.block_start + max_block_size;

    if (s.strstart === 0 || s.strstart >= max_start) {
      /* strstart == 0 is possible when wraparound on 16-bit machine */
      s.lookahead = s.strstart - max_start;
      s.strstart = max_start;
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/


    }
    /* Flush if we may have to slide, otherwise block_start may become
     * negative and the data will be gone:
     */
    if (s.strstart - s.block_start >= (s.w_size - MIN_LOOKAHEAD)) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }

  s.insert = 0;

  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }

  if (s.strstart > s.block_start) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_NEED_MORE;
};

/* ===========================================================================
 * Compress as much as possible from the input stream, return the current
 * block state.
 * This function does not perform lazy evaluation of matches and inserts
 * new strings in the dictionary only for unmatched strings or for short
 * matches. It is used only for the fast compression options.
 */
const deflate_fast = (s, flush) => {

  let hash_head;        /* head of the hash chain */
  let bflush;           /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break; /* flush the current block */
      }
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0/*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     * At this point we have always match_length < MIN_MATCH
     */
    if (hash_head !== 0/*NIL*/ && ((s.strstart - hash_head) <= (s.w_size - MIN_LOOKAHEAD))) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */
    }
    if (s.match_length >= MIN_MATCH) {
      // check_match(s, s.strstart, s.match_start, s.match_length); // for debug only

      /*** _tr_tally_dist(s, s.strstart - s.match_start,
                     s.match_length - MIN_MATCH, bflush); ***/
      bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;

      /* Insert new strings in the hash table only if the match length
       * is not too large. This saves time but degrades compression.
       */
      if (s.match_length <= s.max_lazy_match/*max_insert_length*/ && s.lookahead >= MIN_MATCH) {
        s.match_length--; /* string at strstart already in table */
        do {
          s.strstart++;
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
          /* strstart never exceeds WSIZE-MAX_MATCH, so there are
           * always MIN_MATCH bytes ahead.
           */
        } while (--s.match_length !== 0);
        s.strstart++;
      } else
      {
        s.strstart += s.match_length;
        s.match_length = 0;
        s.ins_h = s.window[s.strstart];
        /* UPDATE_HASH(s, s.ins_h, s.window[s.strstart+1]); */
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1]);

//#if MIN_MATCH != 3
//                Call UPDATE_HASH() MIN_MATCH-3 more times
//#endif
        /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
         * matter since it will be recomputed at next deflate call.
         */
      }
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s.window[s.strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = ((s.strstart < (MIN_MATCH - 1)) ? s.strstart : MIN_MATCH - 1);
  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
};

/* ===========================================================================
 * Same as above, but achieves better compression. We use a lazy
 * evaluation for matches: a match is finally adopted only if there is
 * no better match at the next window position.
 */
const deflate_slow = (s, flush) => {

  let hash_head;          /* head of hash chain */
  let bflush;              /* set if current block must be flushed */

  let max_insert;

  /* Process the input block. */
  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) { break; } /* flush the current block */
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0/*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     */
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;

    if (hash_head !== 0/*NIL*/ && s.prev_length < s.max_lazy_match &&
        s.strstart - hash_head <= (s.w_size - MIN_LOOKAHEAD)/*MAX_DIST(s)*/) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */

      if (s.match_length <= 5 &&
         (s.strategy === Z_FILTERED || (s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096/*TOO_FAR*/))) {

        /* If prev_match is also MIN_MATCH, match_start is garbage
         * but we will ignore the current match anyway.
         */
        s.match_length = MIN_MATCH - 1;
      }
    }
    /* If there was a match at the previous step and the current
     * match is not better, output the previous match:
     */
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      /* Do not insert strings in hash table beyond this. */

      //check_match(s, s.strstart-1, s.prev_match, s.prev_length);

      /***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
                     s.prev_length - MIN_MATCH, bflush);***/
      bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      /* Insert in hash table all strings up to the end of the match.
       * strstart-1 and strstart are already inserted. If there is not
       * enough lookahead, the last two strings are not inserted in
       * the hash table.
       */
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;

      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }

    } else if (s.match_available) {
      /* If there was no match at the previous position, output a
       * single literal. If there was a match but the current match
       * is longer, truncate the previous match to a single literal.
       */
      //Tracevv((stderr,"%c", s->window[s->strstart-1]));
      /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);

      if (bflush) {
        /*** FLUSH_BLOCK_ONLY(s, 0) ***/
        flush_block_only(s, false);
        /***/
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      /* There is no previous match to compare with, wait for
       * the next step to decide.
       */
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  //Assert (flush != Z_NO_FLUSH, "no flush?");
  if (s.match_available) {
    //Tracevv((stderr,"%c", s->window[s->strstart-1]));
    /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
    bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);

    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_BLOCK_DONE;
};


/* ===========================================================================
 * For Z_RLE, simply look for runs of bytes, generate matches only of distance
 * one.  Do not maintain a hash table.  (It will be regenerated if this run of
 * deflate switches away from Z_RLE.)
 */
const deflate_rle = (s, flush) => {

  let bflush;            /* set if current block must be flushed */
  let prev;              /* byte at distance one to match */
  let scan, strend;      /* scan goes up to strend for length of run */

  const _win = s.window;

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the longest run, plus one for the unrolled loop.
     */
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) { break; } /* flush the current block */
    }

    /* See how many times the previous byte repeats */
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {
          /*jshint noempty:false*/
        } while (prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
      //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
    }

    /* Emit match if have run of MIN_MATCH or longer, else emit literal */
    if (s.match_length >= MIN_MATCH) {
      //check_match(s, s.strstart, s.strstart - 1, s.match_length);

      /*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
      bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s->window[s->strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
};

/* ===========================================================================
 * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
 * (It will be regenerated if this run of deflate switches away from Huffman.)
 */
const deflate_huff = (s, flush) => {

  let bflush;             /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we have a literal to write. */
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        break;      /* flush the current block */
      }
    }

    /* Output a literal byte */
    s.match_length = 0;
    //Tracevv((stderr,"%c", s->window[s->strstart]));
    /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
    bflush = _tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
};

/* Values for max_lazy_match, good_match and max_chain_length, depending on
 * the desired pack level (0..9). The values given below have been tuned to
 * exclude worst case performance for pathological files. Better values may be
 * found for specific files.
 */
function Config(good_length, max_lazy, nice_length, max_chain, func) {

  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
}

const configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored),          /* 0 store only */
  new Config(4, 4, 8, 4, deflate_fast),            /* 1 max speed, no lazy matches */
  new Config(4, 5, 16, 8, deflate_fast),           /* 2 */
  new Config(4, 6, 32, 32, deflate_fast),          /* 3 */

  new Config(4, 4, 16, 16, deflate_slow),          /* 4 lazy matches */
  new Config(8, 16, 32, 32, deflate_slow),         /* 5 */
  new Config(8, 16, 128, 128, deflate_slow),       /* 6 */
  new Config(8, 32, 128, 256, deflate_slow),       /* 7 */
  new Config(32, 128, 258, 1024, deflate_slow),    /* 8 */
  new Config(32, 258, 258, 4096, deflate_slow)     /* 9 max compression */
];


/* ===========================================================================
 * Initialize the "longest match" routines for a new zlib stream
 */
const lm_init = (s) => {

  s.window_size = 2 * s.w_size;

  /*** CLEAR_HASH(s); ***/
  zero$2(s.head); // Fill with NIL (= 0);

  /* Set the default configuration parameters:
   */
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;

  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
};


function DeflateState() {
  this.strm = null;            /* pointer back to this zlib stream */
  this.status = 0;            /* as the name implies */
  this.pending_buf = null;      /* output still pending */
  this.pending_buf_size = 0;  /* size of pending_buf */
  this.pending_out = 0;       /* next pending byte to output to the stream */
  this.pending = 0;           /* nb of bytes in the pending buffer */
  this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
  this.gzhead = null;         /* gzip header information to write */
  this.gzindex = 0;           /* where in extra, name, or comment */
  this.method = Z_DEFLATED$2; /* can only be DEFLATED */
  this.last_flush = -1;   /* value of flush param for previous deflate call */

  this.w_size = 0;  /* LZ77 window size (32K by default) */
  this.w_bits = 0;  /* log2(w_size)  (8..16) */
  this.w_mask = 0;  /* w_size - 1 */

  this.window = null;
  /* Sliding window. Input bytes are read into the second half of the window,
   * and move to the first half later to keep a dictionary of at least wSize
   * bytes. With this organization, matches are limited to a distance of
   * wSize-MAX_MATCH bytes, but this ensures that IO is always
   * performed with a length multiple of the block size.
   */

  this.window_size = 0;
  /* Actual size of window: 2*wSize, except when the user input buffer
   * is directly used as sliding window.
   */

  this.prev = null;
  /* Link to older string with same hash index. To limit the size of this
   * array to 64K, this link is maintained only for the last 32K strings.
   * An index in this array is thus a window index modulo 32K.
   */

  this.head = null;   /* Heads of the hash chains or NIL. */

  this.ins_h = 0;       /* hash index of string to be inserted */
  this.hash_size = 0;   /* number of elements in hash table */
  this.hash_bits = 0;   /* log2(hash_size) */
  this.hash_mask = 0;   /* hash_size-1 */

  this.hash_shift = 0;
  /* Number of bits by which ins_h must be shifted at each input
   * step. It must be such that after MIN_MATCH steps, the oldest
   * byte no longer takes part in the hash key, that is:
   *   hash_shift * MIN_MATCH >= hash_bits
   */

  this.block_start = 0;
  /* Window position at the beginning of the current output block. Gets
   * negative when the window is moved backwards.
   */

  this.match_length = 0;      /* length of best match */
  this.prev_match = 0;        /* previous match */
  this.match_available = 0;   /* set if previous match exists */
  this.strstart = 0;          /* start of string to insert */
  this.match_start = 0;       /* start of matching string */
  this.lookahead = 0;         /* number of valid bytes ahead in window */

  this.prev_length = 0;
  /* Length of the best match at previous step. Matches not greater than this
   * are discarded. This is used in the lazy match evaluation.
   */

  this.max_chain_length = 0;
  /* To speed up deflation, hash chains are never searched beyond this
   * length.  A higher limit improves compression ratio but degrades the
   * speed.
   */

  this.max_lazy_match = 0;
  /* Attempt to find a better match only when the current match is strictly
   * smaller than this value. This mechanism is used only for compression
   * levels >= 4.
   */
  // That's alias to max_lazy_match, don't use directly
  //this.max_insert_length = 0;
  /* Insert new strings in the hash table only if the match length is not
   * greater than this length. This saves time but degrades compression.
   * max_insert_length is used only for compression levels <= 3.
   */

  this.level = 0;     /* compression level (1..9) */
  this.strategy = 0;  /* favor or force Huffman coding*/

  this.good_match = 0;
  /* Use a faster search when the previous match is longer than this */

  this.nice_match = 0; /* Stop searching when current match exceeds this */

              /* used by trees.c: */

  /* Didn't use ct_data typedef below to suppress compiler warning */

  // struct ct_data_s dyn_ltree[HEAP_SIZE];   /* literal and length tree */
  // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
  // struct ct_data_s bl_tree[2*BL_CODES+1];  /* Huffman tree for bit lengths */

  // Use flat array of DOUBLE size, with interleaved fata,
  // because JS does not support effective
  this.dyn_ltree  = new Uint16Array(HEAP_SIZE * 2);
  this.dyn_dtree  = new Uint16Array((2 * D_CODES + 1) * 2);
  this.bl_tree    = new Uint16Array((2 * BL_CODES + 1) * 2);
  zero$2(this.dyn_ltree);
  zero$2(this.dyn_dtree);
  zero$2(this.bl_tree);

  this.l_desc   = null;         /* desc. for literal tree */
  this.d_desc   = null;         /* desc. for distance tree */
  this.bl_desc  = null;         /* desc. for bit length tree */

  //ush bl_count[MAX_BITS+1];
  this.bl_count = new Uint16Array(MAX_BITS + 1);
  /* number of codes at each bit length for an optimal tree */

  //int heap[2*L_CODES+1];      /* heap used to build the Huffman trees */
  this.heap = new Uint16Array(2 * L_CODES + 1);  /* heap used to build the Huffman trees */
  zero$2(this.heap);

  this.heap_len = 0;               /* number of elements in the heap */
  this.heap_max = 0;               /* element of largest frequency */
  /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
   * The same heap array is used to build all trees.
   */

  this.depth = new Uint16Array(2 * L_CODES + 1); //uch depth[2*L_CODES+1];
  zero$2(this.depth);
  /* Depth of each subtree used as tie breaker for trees of equal frequency
   */

  this.l_buf = 0;          /* buffer index for literals or lengths */

  this.lit_bufsize = 0;
  /* Size of match buffer for literals/lengths.  There are 4 reasons for
   * limiting lit_bufsize to 64K:
   *   - frequencies can be kept in 16 bit counters
   *   - if compression is not successful for the first block, all input
   *     data is still in the window so we can still emit a stored block even
   *     when input comes from standard input.  (This can also be done for
   *     all blocks if lit_bufsize is not greater than 32K.)
   *   - if compression is not successful for a file smaller than 64K, we can
   *     even emit a stored file instead of a stored block (saving 5 bytes).
   *     This is applicable only for zip (not gzip or zlib).
   *   - creating new Huffman trees less frequently may not provide fast
   *     adaptation to changes in the input data statistics. (Take for
   *     example a binary file with poorly compressible code followed by
   *     a highly compressible string table.) Smaller buffer sizes give
   *     fast adaptation but have of course the overhead of transmitting
   *     trees more frequently.
   *   - I can't count above 4
   */

  this.last_lit = 0;      /* running index in l_buf */

  this.d_buf = 0;
  /* Buffer index for distances. To simplify the code, d_buf and l_buf have
   * the same number of elements. To use different lengths, an extra flag
   * array would be necessary.
   */

  this.opt_len = 0;       /* bit length of current block with optimal trees */
  this.static_len = 0;    /* bit length of current block with static trees */
  this.matches = 0;       /* number of string matches in current block */
  this.insert = 0;        /* bytes at end of window left to insert */


  this.bi_buf = 0;
  /* Output buffer. bits are inserted starting at the bottom (least
   * significant bits).
   */
  this.bi_valid = 0;
  /* Number of valid bits in bi_buf.  All bits above the last valid bit
   * are always zero.
   */

  // Used for window memory init. We safely ignore it for JS. That makes
  // sense only for pointers and memory check tools.
  //this.high_water = 0;
  /* High water mark offset in window for initialized bytes -- bytes above
   * this are set to zero in order to avoid memory check warnings when
   * longest match routines access bytes past the input.  This is then
   * updated to the new high water mark.
   */
}


const deflateResetKeep = (strm) => {

  if (!strm || !strm.state) {
    return err(strm, Z_STREAM_ERROR$2);
  }

  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;

  const s = strm.state;
  s.pending = 0;
  s.pending_out = 0;

  if (s.wrap < 0) {
    s.wrap = -s.wrap;
    /* was made negative by deflate(..., Z_FINISH); */
  }
  s.status = (s.wrap ? INIT_STATE : BUSY_STATE);
  strm.adler = (s.wrap === 2) ?
    0  // crc32(0, Z_NULL, 0)
  :
    1; // adler32(0, Z_NULL, 0)
  s.last_flush = Z_NO_FLUSH$2;
  _tr_init(s);
  return Z_OK$3;
};


const deflateReset = (strm) => {

  const ret = deflateResetKeep(strm);
  if (ret === Z_OK$3) {
    lm_init(strm.state);
  }
  return ret;
};


const deflateSetHeader = (strm, head) => {

  if (!strm || !strm.state) { return Z_STREAM_ERROR$2; }
  if (strm.state.wrap !== 2) { return Z_STREAM_ERROR$2; }
  strm.state.gzhead = head;
  return Z_OK$3;
};


const deflateInit2 = (strm, level, method, windowBits, memLevel, strategy) => {

  if (!strm) { // === Z_NULL
    return Z_STREAM_ERROR$2;
  }
  let wrap = 1;

  if (level === Z_DEFAULT_COMPRESSION$1) {
    level = 6;
  }

  if (windowBits < 0) { /* suppress zlib wrapper */
    wrap = 0;
    windowBits = -windowBits;
  }

  else if (windowBits > 15) {
    wrap = 2;           /* write gzip wrapper instead */
    windowBits -= 16;
  }


  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 ||
    windowBits < 8 || windowBits > 15 || level < 0 || level > 9 ||
    strategy < 0 || strategy > Z_FIXED) {
    return err(strm, Z_STREAM_ERROR$2);
  }


  if (windowBits === 8) {
    windowBits = 9;
  }
  /* until 256-byte window bug fixed */

  const s = new DeflateState();

  strm.state = s;
  s.strm = strm;

  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;

  s.hash_bits = memLevel + 7;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);

  s.window = new Uint8Array(s.w_size * 2);
  s.head = new Uint16Array(s.hash_size);
  s.prev = new Uint16Array(s.w_size);

  // Don't need mem init magic for JS.
  //s.high_water = 0;  /* nothing written to s->window yet */

  s.lit_bufsize = 1 << (memLevel + 6); /* 16K elements by default */

  s.pending_buf_size = s.lit_bufsize * 4;

  //overlay = (ushf *) ZALLOC(strm, s->lit_bufsize, sizeof(ush)+2);
  //s->pending_buf = (uchf *) overlay;
  s.pending_buf = new Uint8Array(s.pending_buf_size);

  // It is offset from `s.pending_buf` (size is `s.lit_bufsize * 2`)
  //s->d_buf = overlay + s->lit_bufsize/sizeof(ush);
  s.d_buf = 1 * s.lit_bufsize;

  //s->l_buf = s->pending_buf + (1+sizeof(ush))*s->lit_bufsize;
  s.l_buf = (1 + 2) * s.lit_bufsize;

  s.level = level;
  s.strategy = strategy;
  s.method = method;

  return deflateReset(strm);
};

const deflateInit = (strm, level) => {

  return deflateInit2(strm, level, Z_DEFLATED$2, MAX_WBITS$1, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY$1);
};


const deflate$2 = (strm, flush) => {

  let beg, val; // for gzip header write only

  if (!strm || !strm.state ||
    flush > Z_BLOCK$1 || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2;
  }

  const s = strm.state;

  if (!strm.output ||
      (!strm.input && strm.avail_in !== 0) ||
      (s.status === FINISH_STATE && flush !== Z_FINISH$3)) {
    return err(strm, (strm.avail_out === 0) ? Z_BUF_ERROR$1 : Z_STREAM_ERROR$2);
  }

  s.strm = strm; /* just in case */
  const old_flush = s.last_flush;
  s.last_flush = flush;

  /* Write the header */
  if (s.status === INIT_STATE) {

    if (s.wrap === 2) { // GZIP header
      strm.adler = 0;  //crc32(0L, Z_NULL, 0);
      put_byte(s, 31);
      put_byte(s, 139);
      put_byte(s, 8);
      if (!s.gzhead) { // s->gzhead == Z_NULL
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, s.level === 9 ? 2 :
                    (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                     4 : 0));
        put_byte(s, OS_CODE);
        s.status = BUSY_STATE;
      }
      else {
        put_byte(s, (s.gzhead.text ? 1 : 0) +
                    (s.gzhead.hcrc ? 2 : 0) +
                    (!s.gzhead.extra ? 0 : 4) +
                    (!s.gzhead.name ? 0 : 8) +
                    (!s.gzhead.comment ? 0 : 16)
        );
        put_byte(s, s.gzhead.time & 0xff);
        put_byte(s, (s.gzhead.time >> 8) & 0xff);
        put_byte(s, (s.gzhead.time >> 16) & 0xff);
        put_byte(s, (s.gzhead.time >> 24) & 0xff);
        put_byte(s, s.level === 9 ? 2 :
                    (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                     4 : 0));
        put_byte(s, s.gzhead.os & 0xff);
        if (s.gzhead.extra && s.gzhead.extra.length) {
          put_byte(s, s.gzhead.extra.length & 0xff);
          put_byte(s, (s.gzhead.extra.length >> 8) & 0xff);
        }
        if (s.gzhead.hcrc) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending, 0);
        }
        s.gzindex = 0;
        s.status = EXTRA_STATE;
      }
    }
    else // DEFLATE header
    {
      let header = (Z_DEFLATED$2 + ((s.w_bits - 8) << 4)) << 8;
      let level_flags = -1;

      if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
        level_flags = 0;
      } else if (s.level < 6) {
        level_flags = 1;
      } else if (s.level === 6) {
        level_flags = 2;
      } else {
        level_flags = 3;
      }
      header |= (level_flags << 6);
      if (s.strstart !== 0) { header |= PRESET_DICT; }
      header += 31 - (header % 31);

      s.status = BUSY_STATE;
      putShortMSB(s, header);

      /* Save the adler32 of the preset dictionary: */
      if (s.strstart !== 0) {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 0xffff);
      }
      strm.adler = 1; // adler32(0L, Z_NULL, 0);
    }
  }

//#ifdef GZIP
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */

      while (s.gzindex < (s.gzhead.extra.length & 0xffff)) {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            break;
          }
        }
        put_byte(s, s.gzhead.extra[s.gzindex] & 0xff);
        s.gzindex++;
      }
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (s.gzindex === s.gzhead.extra.length) {
        s.gzindex = 0;
        s.status = NAME_STATE;
      }
    }
    else {
      s.status = NAME_STATE;
    }
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */
      //int val;

      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);

      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.gzindex = 0;
        s.status = COMMENT_STATE;
      }
    }
    else {
      s.status = COMMENT_STATE;
    }
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */
      //int val;

      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);

      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.status = HCRC_STATE;
      }
    }
    else {
      s.status = HCRC_STATE;
    }
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
      }
      if (s.pending + 2 <= s.pending_buf_size) {
        put_byte(s, strm.adler & 0xff);
        put_byte(s, (strm.adler >> 8) & 0xff);
        strm.adler = 0; //crc32(0L, Z_NULL, 0);
        s.status = BUSY_STATE;
      }
    }
    else {
      s.status = BUSY_STATE;
    }
  }
//#endif

  /* Flush as much pending output as possible */
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      /* Since avail_out is 0, deflate will be called again with
       * more output space, but possibly with both pending and
       * avail_in equal to zero. There won't be anything to do,
       * but this is not an error situation so make sure we
       * return OK instead of BUF_ERROR at next call of deflate:
       */
      s.last_flush = -1;
      return Z_OK$3;
    }

    /* Make sure there is something to do and avoid duplicate consecutive
     * flushes. For repeated and useless calls with Z_FINISH, we keep
     * returning Z_STREAM_END instead of Z_BUF_ERROR.
     */
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) &&
    flush !== Z_FINISH$3) {
    return err(strm, Z_BUF_ERROR$1);
  }

  /* User must not provide more input after the first FINISH: */
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR$1);
  }

  /* Start a new block or continue the current one.
   */
  if (strm.avail_in !== 0 || s.lookahead !== 0 ||
    (flush !== Z_NO_FLUSH$2 && s.status !== FINISH_STATE)) {
    let bstate = (s.strategy === Z_HUFFMAN_ONLY) ? deflate_huff(s, flush) :
      (s.strategy === Z_RLE ? deflate_rle(s, flush) :
        configuration_table[s.level].func(s, flush));

    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        /* avoid BUF_ERROR next call, see above */
      }
      return Z_OK$3;
      /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
       * of deflate should use the same flush parameter to make sure
       * that the flush is complete. So we don't have to output an
       * empty block here, this will be done at next call. This also
       * ensures that for a very small output buffer, we emit at most
       * one empty block.
       */
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        _tr_align(s);
      }
      else if (flush !== Z_BLOCK$1) { /* FULL_FLUSH or SYNC_FLUSH */

        _tr_stored_block(s, 0, 0, false);
        /* For a full flush, this empty block will be recognized
         * as a special marker by inflate_sync().
         */
        if (flush === Z_FULL_FLUSH$1) {
          /*** CLEAR_HASH(s); ***/             /* forget history */
          zero$2(s.head); // Fill with NIL (= 0);

          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1; /* avoid BUF_ERROR at next call, see above */
        return Z_OK$3;
      }
    }
  }
  //Assert(strm->avail_out > 0, "bug2");
  //if (strm.avail_out <= 0) { throw new Error("bug2");}

  if (flush !== Z_FINISH$3) { return Z_OK$3; }
  if (s.wrap <= 0) { return Z_STREAM_END$3; }

  /* Write the trailer */
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 0xff);
    put_byte(s, (strm.adler >> 8) & 0xff);
    put_byte(s, (strm.adler >> 16) & 0xff);
    put_byte(s, (strm.adler >> 24) & 0xff);
    put_byte(s, strm.total_in & 0xff);
    put_byte(s, (strm.total_in >> 8) & 0xff);
    put_byte(s, (strm.total_in >> 16) & 0xff);
    put_byte(s, (strm.total_in >> 24) & 0xff);
  }
  else
  {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 0xffff);
  }

  flush_pending(strm);
  /* If avail_out is zero, the application will call deflate again
   * to flush the rest.
   */
  if (s.wrap > 0) { s.wrap = -s.wrap; }
  /* write the trailer only once! */
  return s.pending !== 0 ? Z_OK$3 : Z_STREAM_END$3;
};


const deflateEnd = (strm) => {

  if (!strm/*== Z_NULL*/ || !strm.state/*== Z_NULL*/) {
    return Z_STREAM_ERROR$2;
  }

  const status = strm.state.status;
  if (status !== INIT_STATE &&
    status !== EXTRA_STATE &&
    status !== NAME_STATE &&
    status !== COMMENT_STATE &&
    status !== HCRC_STATE &&
    status !== BUSY_STATE &&
    status !== FINISH_STATE
  ) {
    return err(strm, Z_STREAM_ERROR$2);
  }

  strm.state = null;

  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$3;
};


/* =========================================================================
 * Initializes the compression dictionary from the given byte
 * sequence without producing any compressed output.
 */
const deflateSetDictionary = (strm, dictionary) => {

  let dictLength = dictionary.length;

  if (!strm/*== Z_NULL*/ || !strm.state/*== Z_NULL*/) {
    return Z_STREAM_ERROR$2;
  }

  const s = strm.state;
  const wrap = s.wrap;

  if (wrap === 2 || (wrap === 1 && s.status !== INIT_STATE) || s.lookahead) {
    return Z_STREAM_ERROR$2;
  }

  /* when using zlib wrappers, compute Adler-32 for provided dictionary */
  if (wrap === 1) {
    /* adler32(strm->adler, dictionary, dictLength); */
    strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0);
  }

  s.wrap = 0;   /* avoid computing Adler-32 in read_buf */

  /* if dictionary would fill window, just replace the history */
  if (dictLength >= s.w_size) {
    if (wrap === 0) {            /* already empty otherwise */
      /*** CLEAR_HASH(s); ***/
      zero$2(s.head); // Fill with NIL (= 0);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    /* use the tail */
    // dictionary = dictionary.slice(dictLength - s.w_size);
    let tmpDict = new Uint8Array(s.w_size);
    tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  /* insert dictionary into window and hash */
  const avail = strm.avail_in;
  const next = strm.next_in;
  const input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    let str = s.strstart;
    let n = s.lookahead - (MIN_MATCH - 1);
    do {
      /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
      s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);

      s.prev[str & s.w_mask] = s.head[s.ins_h];

      s.head[s.ins_h] = str;
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return Z_OK$3;
};


var deflateInit_1 = deflateInit;
var deflateInit2_1 = deflateInit2;
var deflateReset_1 = deflateReset;
var deflateResetKeep_1 = deflateResetKeep;
var deflateSetHeader_1 = deflateSetHeader;
var deflate_2$1 = deflate$2;
var deflateEnd_1 = deflateEnd;
var deflateSetDictionary_1 = deflateSetDictionary;
var deflateInfo = 'pako deflate (from Nodeca project)';

/* Not implemented
module.exports.deflateBound = deflateBound;
module.exports.deflateCopy = deflateCopy;
module.exports.deflateParams = deflateParams;
module.exports.deflatePending = deflatePending;
module.exports.deflatePrime = deflatePrime;
module.exports.deflateTune = deflateTune;
*/

var deflate_1$2 = {
	deflateInit: deflateInit_1,
	deflateInit2: deflateInit2_1,
	deflateReset: deflateReset_1,
	deflateResetKeep: deflateResetKeep_1,
	deflateSetHeader: deflateSetHeader_1,
	deflate: deflate_2$1,
	deflateEnd: deflateEnd_1,
	deflateSetDictionary: deflateSetDictionary_1,
	deflateInfo: deflateInfo
};

const _has = (obj, key) => {
  return Object.prototype.hasOwnProperty.call(obj, key);
};

var assign = function (obj /*from1, from2, from3, ...*/) {
  const sources = Array.prototype.slice.call(arguments, 1);
  while (sources.length) {
    const source = sources.shift();
    if (!source) { continue; }

    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be non-object');
    }

    for (const p in source) {
      if (_has(source, p)) {
        obj[p] = source[p];
      }
    }
  }

  return obj;
};


// Join array of chunks to single array.
var flattenChunks = (chunks) => {
  // calculate data length
  let len = 0;

  for (let i = 0, l = chunks.length; i < l; i++) {
    len += chunks[i].length;
  }

  // join chunks
  const result = new Uint8Array(len);

  for (let i = 0, pos = 0, l = chunks.length; i < l; i++) {
    let chunk = chunks[i];
    result.set(chunk, pos);
    pos += chunk.length;
  }

  return result;
};

var common = {
	assign: assign,
	flattenChunks: flattenChunks
};

// String encode/decode helpers


// Quick check if we can use fast array to bin string conversion
//
// - apply(Array) can fail on Android 2.2
// - apply(Uint8Array) can fail on iOS 5.1 Safari
//
let STR_APPLY_UIA_OK = true;

try { String.fromCharCode.apply(null, new Uint8Array(1)); } catch (__) { STR_APPLY_UIA_OK = false; }


// Table with utf8 lengths (calculated by first byte of sequence)
// Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
// because max possible codepoint is 0x10ffff
const _utf8len = new Uint8Array(256);
for (let q = 0; q < 256; q++) {
  _utf8len[q] = (q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1);
}
_utf8len[254] = _utf8len[254] = 1; // Invalid sequence start


// convert string to array (typed, when possible)
var string2buf = (str) => {
  if (typeof TextEncoder === 'function' && TextEncoder.prototype.encode) {
    return new TextEncoder().encode(str);
  }

  let buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;

  // count binary size
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 0xfc00) === 0xd800 && (m_pos + 1 < str_len)) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 0xfc00) === 0xdc00) {
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        m_pos++;
      }
    }
    buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }

  // allocate buffer
  buf = new Uint8Array(buf_len);

  // convert
  for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 0xfc00) === 0xd800 && (m_pos + 1 < str_len)) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 0xfc00) === 0xdc00) {
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        m_pos++;
      }
    }
    if (c < 0x80) {
      /* one byte */
      buf[i++] = c;
    } else if (c < 0x800) {
      /* two bytes */
      buf[i++] = 0xC0 | (c >>> 6);
      buf[i++] = 0x80 | (c & 0x3f);
    } else if (c < 0x10000) {
      /* three bytes */
      buf[i++] = 0xE0 | (c >>> 12);
      buf[i++] = 0x80 | (c >>> 6 & 0x3f);
      buf[i++] = 0x80 | (c & 0x3f);
    } else {
      /* four bytes */
      buf[i++] = 0xf0 | (c >>> 18);
      buf[i++] = 0x80 | (c >>> 12 & 0x3f);
      buf[i++] = 0x80 | (c >>> 6 & 0x3f);
      buf[i++] = 0x80 | (c & 0x3f);
    }
  }

  return buf;
};

// Helper
const buf2binstring = (buf, len) => {
  // On Chrome, the arguments in a function call that are allowed is `65534`.
  // If the length of the buffer is smaller than that, we can use this optimization,
  // otherwise we will take a slower path.
  if (len < 65534) {
    if (buf.subarray && STR_APPLY_UIA_OK) {
      return String.fromCharCode.apply(null, buf.length === len ? buf : buf.subarray(0, len));
    }
  }

  let result = '';
  for (let i = 0; i < len; i++) {
    result += String.fromCharCode(buf[i]);
  }
  return result;
};


// convert array to string
var buf2string = (buf, max) => {
  const len = max || buf.length;

  if (typeof TextDecoder === 'function' && TextDecoder.prototype.decode) {
    return new TextDecoder().decode(buf.subarray(0, max));
  }

  let i, out;

  // Reserve max possible length (2 words per char)
  // NB: by unknown reasons, Array is significantly faster for
  //     String.fromCharCode.apply than Uint16Array.
  const utf16buf = new Array(len * 2);

  for (out = 0, i = 0; i < len;) {
    let c = buf[i++];
    // quick process ascii
    if (c < 0x80) { utf16buf[out++] = c; continue; }

    let c_len = _utf8len[c];
    // skip 5 & 6 byte codes
    if (c_len > 4) { utf16buf[out++] = 0xfffd; i += c_len - 1; continue; }

    // apply mask on first byte
    c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07;
    // join the rest
    while (c_len > 1 && i < len) {
      c = (c << 6) | (buf[i++] & 0x3f);
      c_len--;
    }

    // terminated by end of string?
    if (c_len > 1) { utf16buf[out++] = 0xfffd; continue; }

    if (c < 0x10000) {
      utf16buf[out++] = c;
    } else {
      c -= 0x10000;
      utf16buf[out++] = 0xd800 | ((c >> 10) & 0x3ff);
      utf16buf[out++] = 0xdc00 | (c & 0x3ff);
    }
  }

  return buf2binstring(utf16buf, out);
};


// Calculate max possible position in utf8 buffer,
// that will not break sequence. If that's not possible
// - (very small limits) return max size as is.
//
// buf[] - utf8 bytes array
// max   - length limit (mandatory);
var utf8border = (buf, max) => {

  max = max || buf.length;
  if (max > buf.length) { max = buf.length; }

  // go back from last position, until start of sequence found
  let pos = max - 1;
  while (pos >= 0 && (buf[pos] & 0xC0) === 0x80) { pos--; }

  // Very small and broken sequence,
  // return max, because we should return something anyway.
  if (pos < 0) { return max; }

  // If we came to start of buffer - that means buffer is too small,
  // return max too.
  if (pos === 0) { return max; }

  return (pos + _utf8len[buf[pos]] > max) ? pos : max;
};

var strings = {
	string2buf: string2buf,
	buf2string: buf2string,
	utf8border: utf8border
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function ZStream() {
  /* next input byte */
  this.input = null; // JS specific, because we have no pointers
  this.next_in = 0;
  /* number of bytes available at input */
  this.avail_in = 0;
  /* total number of input bytes read so far */
  this.total_in = 0;
  /* next output byte should be put there */
  this.output = null; // JS specific, because we have no pointers
  this.next_out = 0;
  /* remaining free space at output */
  this.avail_out = 0;
  /* total number of bytes output so far */
  this.total_out = 0;
  /* last error message, NULL if no error */
  this.msg = ''/*Z_NULL*/;
  /* not visible by applications */
  this.state = null;
  /* best guess about the data type: binary or text */
  this.data_type = 2/*Z_UNKNOWN*/;
  /* adler32 value of the uncompressed data */
  this.adler = 0;
}

var zstream = ZStream;

const toString$1 = Object.prototype.toString;

/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
  Z_NO_FLUSH: Z_NO_FLUSH$1, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_FINISH: Z_FINISH$2,
  Z_OK: Z_OK$2, Z_STREAM_END: Z_STREAM_END$2,
  Z_DEFAULT_COMPRESSION,
  Z_DEFAULT_STRATEGY,
  Z_DEFLATED: Z_DEFLATED$1
} = constants$2;

/* ===========================================================================*/


/**
 * class Deflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[deflate]],
 * [[deflateRaw]] and [[gzip]].
 **/

/* internal
 * Deflate.chunks -> Array
 *
 * Chunks of output data, if [[Deflate#onData]] not overridden.
 **/

/**
 * Deflate.result -> Uint8Array
 *
 * Compressed result, generated by default [[Deflate#onData]]
 * and [[Deflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Deflate#push]] with `Z_FINISH` / `true` param).
 **/

/**
 * Deflate.err -> Number
 *
 * Error code after deflate finished. 0 (Z_OK) on success.
 * You will not need it in real life, because deflate errors
 * are possible only on wrong options or bad `onData` / `onEnd`
 * custom handlers.
 **/

/**
 * Deflate.msg -> String
 *
 * Error message, if [[Deflate.err]] != 0
 **/


/**
 * new Deflate(options)
 * - options (Object): zlib deflate options.
 *
 * Creates new deflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `level`
 * - `windowBits`
 * - `memLevel`
 * - `strategy`
 * - `dictionary`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw deflate
 * - `gzip` (Boolean) - create gzip wrapper
 * - `header` (Object) - custom header for gzip
 *   - `text` (Boolean) - true if compressed data believed to be text
 *   - `time` (Number) - modification time, unix timestamp
 *   - `os` (Number) - operation system code
 *   - `extra` (Array) - array of bytes with extra data (max 65536)
 *   - `name` (String) - file name (binary string)
 *   - `comment` (String) - comment (binary string)
 *   - `hcrc` (Boolean) - true if header crc should be added
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako')
 *   , chunk1 = new Uint8Array([1,2,3,4,5,6,7,8,9])
 *   , chunk2 = new Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * const deflate = new pako.Deflate({ level: 3});
 *
 * deflate.push(chunk1, false);
 * deflate.push(chunk2, true);  // true -> last chunk
 *
 * if (deflate.err) { throw new Error(deflate.err); }
 *
 * console.log(deflate.result);
 * ```
 **/
function Deflate$1(options) {
  this.options = common.assign({
    level: Z_DEFAULT_COMPRESSION,
    method: Z_DEFLATED$1,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: Z_DEFAULT_STRATEGY
  }, options || {});

  let opt = this.options;

  if (opt.raw && (opt.windowBits > 0)) {
    opt.windowBits = -opt.windowBits;
  }

  else if (opt.gzip && (opt.windowBits > 0) && (opt.windowBits < 16)) {
    opt.windowBits += 16;
  }

  this.err    = 0;      // error code, if happens (0 = Z_OK)
  this.msg    = '';     // error message
  this.ended  = false;  // used to avoid multiple onEnd() calls
  this.chunks = [];     // chunks of compressed data

  this.strm = new zstream();
  this.strm.avail_out = 0;

  let status = deflate_1$2.deflateInit2(
    this.strm,
    opt.level,
    opt.method,
    opt.windowBits,
    opt.memLevel,
    opt.strategy
  );

  if (status !== Z_OK$2) {
    throw new Error(messages[status]);
  }

  if (opt.header) {
    deflate_1$2.deflateSetHeader(this.strm, opt.header);
  }

  if (opt.dictionary) {
    let dict;
    // Convert data if needed
    if (typeof opt.dictionary === 'string') {
      // If we need to compress text, change encoding to utf8.
      dict = strings.string2buf(opt.dictionary);
    } else if (toString$1.call(opt.dictionary) === '[object ArrayBuffer]') {
      dict = new Uint8Array(opt.dictionary);
    } else {
      dict = opt.dictionary;
    }

    status = deflate_1$2.deflateSetDictionary(this.strm, dict);

    if (status !== Z_OK$2) {
      throw new Error(messages[status]);
    }

    this._dict_set = true;
  }
}

/**
 * Deflate#push(data[, flush_mode]) -> Boolean
 * - data (Uint8Array|ArrayBuffer|String): input data. Strings will be
 *   converted to utf8 byte sequence.
 * - flush_mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
 *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
 *
 * Sends input data to deflate pipe, generating [[Deflate#onData]] calls with
 * new compressed chunks. Returns `true` on success. The last data block must
 * have `flush_mode` Z_FINISH (or `true`). That will flush internal pending
 * buffers and call [[Deflate#onEnd]].
 *
 * On fail call [[Deflate#onEnd]] with error code and return false.
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Deflate$1.prototype.push = function (data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  let status, _flush_mode;

  if (this.ended) { return false; }

  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH$2 : Z_NO_FLUSH$1;

  // Convert data if needed
  if (typeof data === 'string') {
    // If we need to compress text, change encoding to utf8.
    strm.input = strings.string2buf(data);
  } else if (toString$1.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }

  strm.next_in = 0;
  strm.avail_in = strm.input.length;

  for (;;) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }

    // Make sure avail_out > 6 to avoid repeating markers
    if ((_flush_mode === Z_SYNC_FLUSH || _flush_mode === Z_FULL_FLUSH) && strm.avail_out <= 6) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }

    status = deflate_1$2.deflate(strm, _flush_mode);

    // Ended => flush and finish
    if (status === Z_STREAM_END$2) {
      if (strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out));
      }
      status = deflate_1$2.deflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return status === Z_OK$2;
    }

    // Flush if out buffer full
    if (strm.avail_out === 0) {
      this.onData(strm.output);
      continue;
    }

    // Flush if requested and has data
    if (_flush_mode > 0 && strm.next_out > 0) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }

    if (strm.avail_in === 0) break;
  }

  return true;
};


/**
 * Deflate#onData(chunk) -> Void
 * - chunk (Uint8Array): output data.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Deflate$1.prototype.onData = function (chunk) {
  this.chunks.push(chunk);
};


/**
 * Deflate#onEnd(status) -> Void
 * - status (Number): deflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called once after you tell deflate that the input stream is
 * complete (Z_FINISH). By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Deflate$1.prototype.onEnd = function (status) {
  // On success - join
  if (status === Z_OK$2) {
    this.result = common.flattenChunks(this.chunks);
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};


/**
 * deflate(data[, options]) -> Uint8Array
 * - data (Uint8Array|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * Compress `data` with deflate algorithm and `options`.
 *
 * Supported options are:
 *
 * - level
 * - windowBits
 * - memLevel
 * - strategy
 * - dictionary
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako')
 * const data = new Uint8Array([1,2,3,4,5,6,7,8,9]);
 *
 * console.log(pako.deflate(data));
 * ```
 **/
function deflate$1(input, options) {
  const deflator = new Deflate$1(options);

  deflator.push(input, true);

  // That will never happens, if you don't cheat with options :)
  if (deflator.err) { throw deflator.msg || messages[deflator.err]; }

  return deflator.result;
}


/**
 * deflateRaw(data[, options]) -> Uint8Array
 * - data (Uint8Array|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * The same as [[deflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function deflateRaw$1(input, options) {
  options = options || {};
  options.raw = true;
  return deflate$1(input, options);
}


/**
 * gzip(data[, options]) -> Uint8Array
 * - data (Uint8Array|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * The same as [[deflate]], but create gzip wrapper instead of
 * deflate one.
 **/
function gzip$1(input, options) {
  options = options || {};
  options.gzip = true;
  return deflate$1(input, options);
}


var Deflate_1$1 = Deflate$1;
var deflate_2 = deflate$1;
var deflateRaw_1$1 = deflateRaw$1;
var gzip_1$1 = gzip$1;
var constants$1 = constants$2;

var deflate_1$1 = {
	Deflate: Deflate_1$1,
	deflate: deflate_2,
	deflateRaw: deflateRaw_1$1,
	gzip: gzip_1$1,
	constants: constants$1
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// See state defs from inflate.js
const BAD$1 = 30;       /* got a data error -- remain here until reset */
const TYPE$1 = 12;      /* i: waiting for type bits, including last-flag bit */

/*
   Decode literal, length, and distance codes and write out the resulting
   literal and match bytes until either not enough input or output is
   available, an end-of-block is encountered, or a data error is encountered.
   When large enough input and output buffers are supplied to inflate(), for
   example, a 16K input buffer and a 64K output buffer, more than 95% of the
   inflate execution time is spent in this routine.

   Entry assumptions:

        state.mode === LEN
        strm.avail_in >= 6
        strm.avail_out >= 258
        start >= strm.avail_out
        state.bits < 8

   On return, state.mode is one of:

        LEN -- ran out of enough output space or enough available input
        TYPE -- reached end of block code, inflate() to interpret next block
        BAD -- error in block data

   Notes:

    - The maximum input bits used by a length/distance pair is 15 bits for the
      length code, 5 bits for the length extra, 15 bits for the distance code,
      and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
      Therefore if strm.avail_in >= 6, then there is enough input to avoid
      checking for available input while decoding.

    - The maximum bytes that a single length/distance pair can output is 258
      bytes, which is the maximum length that can be coded.  inflate_fast()
      requires strm.avail_out >= 258 for each loop to avoid checking for
      output space.
 */
var inffast = function inflate_fast(strm, start) {
  let _in;                    /* local strm.input */
  let last;                   /* have enough input while in < last */
  let _out;                   /* local strm.output */
  let beg;                    /* inflate()'s initial strm.output */
  let end;                    /* while out < end, enough space available */
//#ifdef INFLATE_STRICT
  let dmax;                   /* maximum distance from zlib header */
//#endif
  let wsize;                  /* window size or zero if not using window */
  let whave;                  /* valid bytes in the window */
  let wnext;                  /* window write index */
  // Use `s_window` instead `window`, avoid conflict with instrumentation tools
  let s_window;               /* allocated sliding window, if wsize != 0 */
  let hold;                   /* local strm.hold */
  let bits;                   /* local strm.bits */
  let lcode;                  /* local strm.lencode */
  let dcode;                  /* local strm.distcode */
  let lmask;                  /* mask for first level of length codes */
  let dmask;                  /* mask for first level of distance codes */
  let here;                   /* retrieved table entry */
  let op;                     /* code bits, operation, extra bits, or */
                              /*  window position, window bytes to copy */
  let len;                    /* match length, unused bytes */
  let dist;                   /* match distance */
  let from;                   /* where to copy match from */
  let from_source;


  let input, output; // JS specific, because we have no pointers

  /* copy state to local variables */
  const state = strm.state;
  //here = state.here;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
//#ifdef INFLATE_STRICT
  dmax = state.dmax;
//#endif
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;


  /* decode literals and length/distances until end-of-block or not enough
     input data or output space */

  top:
  do {
    if (bits < 15) {
      hold += input[_in++] << bits;
      bits += 8;
      hold += input[_in++] << bits;
      bits += 8;
    }

    here = lcode[hold & lmask];

    dolen:
    for (;;) { // Goto emulation
      op = here >>> 24/*here.bits*/;
      hold >>>= op;
      bits -= op;
      op = (here >>> 16) & 0xff/*here.op*/;
      if (op === 0) {                          /* literal */
        //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
        //        "inflate:         literal '%c'\n" :
        //        "inflate:         literal 0x%02x\n", here.val));
        output[_out++] = here & 0xffff/*here.val*/;
      }
      else if (op & 16) {                     /* length base */
        len = here & 0xffff/*here.val*/;
        op &= 15;                           /* number of extra bits */
        if (op) {
          if (bits < op) {
            hold += input[_in++] << bits;
            bits += 8;
          }
          len += hold & ((1 << op) - 1);
          hold >>>= op;
          bits -= op;
        }
        //Tracevv((stderr, "inflate:         length %u\n", len));
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = dcode[hold & dmask];

        dodist:
        for (;;) { // goto emulation
          op = here >>> 24/*here.bits*/;
          hold >>>= op;
          bits -= op;
          op = (here >>> 16) & 0xff/*here.op*/;

          if (op & 16) {                      /* distance base */
            dist = here & 0xffff/*here.val*/;
            op &= 15;                       /* number of extra bits */
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
            }
            dist += hold & ((1 << op) - 1);
//#ifdef INFLATE_STRICT
            if (dist > dmax) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD$1;
              break top;
            }
//#endif
            hold >>>= op;
            bits -= op;
            //Tracevv((stderr, "inflate:         distance %u\n", dist));
            op = _out - beg;                /* max distance in output */
            if (dist > op) {                /* see if copy from window */
              op = dist - op;               /* distance back in window */
              if (op > whave) {
                if (state.sane) {
                  strm.msg = 'invalid distance too far back';
                  state.mode = BAD$1;
                  break top;
                }

// (!) This block is disabled in zlib defaults,
// don't enable it for binary compatibility
//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
//                if (len <= op - whave) {
//                  do {
//                    output[_out++] = 0;
//                  } while (--len);
//                  continue top;
//                }
//                len -= op - whave;
//                do {
//                  output[_out++] = 0;
//                } while (--op > whave);
//                if (op === 0) {
//                  from = _out - dist;
//                  do {
//                    output[_out++] = output[from++];
//                  } while (--len);
//                  continue top;
//                }
//#endif
              }
              from = 0; // window index
              from_source = s_window;
              if (wnext === 0) {           /* very common case */
                from += wsize - op;
                if (op < len) {         /* some from window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist;  /* rest from output */
                  from_source = output;
                }
              }
              else if (wnext < op) {      /* wrap around window */
                from += wsize + wnext - op;
                op -= wnext;
                if (op < len) {         /* some from end of window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = 0;
                  if (wnext < len) {  /* some from start of window */
                    op = wnext;
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist;      /* rest from output */
                    from_source = output;
                  }
                }
              }
              else {                      /* contiguous in window */
                from += wnext - op;
                if (op < len) {         /* some from window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist;  /* rest from output */
                  from_source = output;
                }
              }
              while (len > 2) {
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                len -= 3;
              }
              if (len) {
                output[_out++] = from_source[from++];
                if (len > 1) {
                  output[_out++] = from_source[from++];
                }
              }
            }
            else {
              from = _out - dist;          /* copy direct from output */
              do {                        /* minimum length is three */
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                len -= 3;
              } while (len > 2);
              if (len) {
                output[_out++] = output[from++];
                if (len > 1) {
                  output[_out++] = output[from++];
                }
              }
            }
          }
          else if ((op & 64) === 0) {          /* 2nd level distance code */
            here = dcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
            continue dodist;
          }
          else {
            strm.msg = 'invalid distance code';
            state.mode = BAD$1;
            break top;
          }

          break; // need to emulate goto via "continue"
        }
      }
      else if ((op & 64) === 0) {              /* 2nd level length code */
        here = lcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
        continue dolen;
      }
      else if (op & 32) {                     /* end-of-block */
        //Tracevv((stderr, "inflate:         end of block\n"));
        state.mode = TYPE$1;
        break top;
      }
      else {
        strm.msg = 'invalid literal/length code';
        state.mode = BAD$1;
        break top;
      }

      break; // need to emulate goto via "continue"
    }
  } while (_in < last && _out < end);

  /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;

  /* update state and return */
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = (_in < last ? 5 + (last - _in) : 5 - (_in - last));
  strm.avail_out = (_out < end ? 257 + (end - _out) : 257 - (_out - end));
  state.hold = hold;
  state.bits = bits;
  return;
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const MAXBITS = 15;
const ENOUGH_LENS$1 = 852;
const ENOUGH_DISTS$1 = 592;
//const ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

const CODES$1 = 0;
const LENS$1 = 1;
const DISTS$1 = 2;

const lbase = new Uint16Array([ /* Length codes 257..285 base */
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
]);

const lext = new Uint8Array([ /* Length codes 257..285 extra */
  16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18,
  19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78
]);

const dbase = new Uint16Array([ /* Distance codes 0..29 base */
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577, 0, 0
]);

const dext = new Uint8Array([ /* Distance codes 0..29 extra */
  16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22,
  23, 23, 24, 24, 25, 25, 26, 26, 27, 27,
  28, 28, 29, 29, 64, 64
]);

const inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) =>
{
  const bits = opts.bits;
      //here = opts.here; /* table entry for duplication */

  let len = 0;               /* a code's length in bits */
  let sym = 0;               /* index of code symbols */
  let min = 0, max = 0;          /* minimum and maximum code lengths */
  let root = 0;              /* number of index bits for root table */
  let curr = 0;              /* number of index bits for current table */
  let drop = 0;              /* code bits to drop for sub-table */
  let left = 0;                   /* number of prefix codes available */
  let used = 0;              /* code entries in table used */
  let huff = 0;              /* Huffman code */
  let incr;              /* for incrementing code, index */
  let fill;              /* index for replicating entries */
  let low;               /* low bits for current root entry */
  let mask;              /* mask for low root bits */
  let next;             /* next available space in table */
  let base = null;     /* base value table to use */
  let base_index = 0;
//  let shoextra;    /* extra bits table to use */
  let end;                    /* use base and extra for symbol > end */
  const count = new Uint16Array(MAXBITS + 1); //[MAXBITS+1];    /* number of codes of each length */
  const offs = new Uint16Array(MAXBITS + 1); //[MAXBITS+1];     /* offsets in table for each length */
  let extra = null;
  let extra_index = 0;

  let here_bits, here_op, here_val;

  /*
   Process a set of code lengths to create a canonical Huffman code.  The
   code lengths are lens[0..codes-1].  Each length corresponds to the
   symbols 0..codes-1.  The Huffman code is generated by first sorting the
   symbols by length from short to long, and retaining the symbol order
   for codes with equal lengths.  Then the code starts with all zero bits
   for the first code of the shortest length, and the codes are integer
   increments for the same length, and zeros are appended as the length
   increases.  For the deflate format, these bits are stored backwards
   from their more natural integer increment ordering, and so when the
   decoding tables are built in the large loop below, the integer codes
   are incremented backwards.

   This routine assumes, but does not check, that all of the entries in
   lens[] are in the range 0..MAXBITS.  The caller must assure this.
   1..MAXBITS is interpreted as that code length.  zero means that that
   symbol does not occur in this code.

   The codes are sorted by computing a count of codes for each length,
   creating from that a table of starting indices for each length in the
   sorted table, and then entering the symbols in order in the sorted
   table.  The sorted table is work[], with that space being provided by
   the caller.

   The length counts are used for other purposes as well, i.e. finding
   the minimum and maximum length codes, determining if there are any
   codes at all, checking for a valid set of lengths, and looking ahead
   at length counts to determine sub-table sizes when building the
   decoding tables.
   */

  /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }

  /* bound code lengths, force root to be within code lengths */
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) { break; }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {                     /* no symbols to code at all */
    //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
    //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
    //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;


    //table.op[opts.table_index] = 64;
    //table.bits[opts.table_index] = 1;
    //table.val[opts.table_index++] = 0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;

    opts.bits = 1;
    return 0;     /* no symbols, but wait for decoding to report error */
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) { break; }
  }
  if (root < min) {
    root = min;
  }

  /* check for an over-subscribed or incomplete set of lengths */
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }        /* over-subscribed */
  }
  if (left > 0 && (type === CODES$1 || max !== 1)) {
    return -1;                      /* incomplete set */
  }

  /* generate offsets into symbol table for each length for sorting */
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }

  /* sort symbols by length, by symbol order within each length */
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }

  /*
   Create and fill in decoding tables.  In this loop, the table being
   filled is at next and has curr index bits.  The code being used is huff
   with length len.  That code is converted to an index by dropping drop
   bits off of the bottom.  For codes where len is less than drop + curr,
   those top drop + curr - len bits are incremented through all values to
   fill the table with replicated entries.

   root is the number of index bits for the root table.  When len exceeds
   root, sub-tables are created pointed to by the root entry with an index
   of the low root bits of huff.  This is saved in low to check for when a
   new sub-table should be started.  drop is zero when the root table is
   being filled, and drop is root when sub-tables are being filled.

   When a new sub-table is needed, it is necessary to look ahead in the
   code lengths to determine what size sub-table is needed.  The length
   counts are used for this, and so count[] is decremented as codes are
   entered in the tables.

   used keeps track of how many table entries have been allocated from the
   provided *table space.  It is checked for LENS and DIST tables against
   the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
   the initial root table size constants.  See the comments in inftrees.h
   for more information.

   sym increments through all symbols, and the loop terminates when
   all codes of length max, i.e. all codes, have been processed.  This
   routine permits incomplete codes, so another loop after this one fills
   in the rest of the decoding tables with invalid code markers.
   */

  /* set up for code type */
  // poor man optimization - use if-else instead of switch,
  // to avoid deopts in old v8
  if (type === CODES$1) {
    base = extra = work;    /* dummy value--not used */
    end = 19;

  } else if (type === LENS$1) {
    base = lbase;
    base_index -= 257;
    extra = lext;
    extra_index -= 257;
    end = 256;

  } else {                    /* DISTS */
    base = dbase;
    extra = dext;
    end = -1;
  }

  /* initialize opts for loop */
  huff = 0;                   /* starting code */
  sym = 0;                    /* starting code symbol */
  len = min;                  /* starting code length */
  next = table_index;              /* current table to fill in */
  curr = root;                /* current table index bits */
  drop = 0;                   /* current bits to drop from code for index */
  low = -1;                   /* trigger new sub-table when len > root */
  used = 1 << root;          /* use root table entries */
  mask = used - 1;            /* mask for comparing low */

  /* check available table space */
  if ((type === LENS$1 && used > ENOUGH_LENS$1) ||
    (type === DISTS$1 && used > ENOUGH_DISTS$1)) {
    return 1;
  }

  /* process all codes and make table entries */
  for (;;) {
    /* create table entry */
    here_bits = len - drop;
    if (work[sym] < end) {
      here_op = 0;
      here_val = work[sym];
    }
    else if (work[sym] > end) {
      here_op = extra[extra_index + work[sym]];
      here_val = base[base_index + work[sym]];
    }
    else {
      here_op = 32 + 64;         /* end of block */
      here_val = 0;
    }

    /* replicate for those indices with low len bits equal to huff */
    incr = 1 << (len - drop);
    fill = 1 << curr;
    min = fill;                 /* save offset to next table */
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val |0;
    } while (fill !== 0);

    /* backwards increment the len-bit code huff */
    incr = 1 << (len - 1);
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }

    /* go to next symbol, update count, len */
    sym++;
    if (--count[len] === 0) {
      if (len === max) { break; }
      len = lens[lens_index + work[sym]];
    }

    /* create new sub-table if needed */
    if (len > root && (huff & mask) !== low) {
      /* if first time, transition to sub-tables */
      if (drop === 0) {
        drop = root;
      }

      /* increment past last table */
      next += min;            /* here min is 1 << curr */

      /* determine length of next table */
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) { break; }
        curr++;
        left <<= 1;
      }

      /* check for enough space */
      used += 1 << curr;
      if ((type === LENS$1 && used > ENOUGH_LENS$1) ||
        (type === DISTS$1 && used > ENOUGH_DISTS$1)) {
        return 1;
      }

      /* point entry in root table to sub-table */
      low = huff & mask;
      /*table.op[low] = curr;
      table.bits[low] = root;
      table.val[low] = next - opts.table_index;*/
      table[low] = (root << 24) | (curr << 16) | (next - table_index) |0;
    }
  }

  /* fill in remaining table entry if code is incomplete (guaranteed to have
   at most one remaining entry, since if the code is incomplete, the
   maximum code length that was allowed to get this far is one bit) */
  if (huff !== 0) {
    //table.op[next + huff] = 64;            /* invalid code marker */
    //table.bits[next + huff] = len - drop;
    //table.val[next + huff] = 0;
    table[next + huff] = ((len - drop) << 24) | (64 << 16) |0;
  }

  /* set return parameters */
  //opts.table_index += used;
  opts.bits = root;
  return 0;
};


var inftrees = inflate_table;

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.






const CODES = 0;
const LENS = 1;
const DISTS = 2;

/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
  Z_FINISH: Z_FINISH$1, Z_BLOCK, Z_TREES,
  Z_OK: Z_OK$1, Z_STREAM_END: Z_STREAM_END$1, Z_NEED_DICT: Z_NEED_DICT$1, Z_STREAM_ERROR: Z_STREAM_ERROR$1, Z_DATA_ERROR: Z_DATA_ERROR$1, Z_MEM_ERROR: Z_MEM_ERROR$1, Z_BUF_ERROR,
  Z_DEFLATED
} = constants$2;


/* STATES ====================================================================*/
/* ===========================================================================*/


const    HEAD = 1;       /* i: waiting for magic header */
const    FLAGS = 2;      /* i: waiting for method and flags (gzip) */
const    TIME = 3;       /* i: waiting for modification time (gzip) */
const    OS = 4;         /* i: waiting for extra flags and operating system (gzip) */
const    EXLEN = 5;      /* i: waiting for extra length (gzip) */
const    EXTRA = 6;      /* i: waiting for extra bytes (gzip) */
const    NAME = 7;       /* i: waiting for end of file name (gzip) */
const    COMMENT = 8;    /* i: waiting for end of comment (gzip) */
const    HCRC = 9;       /* i: waiting for header crc (gzip) */
const    DICTID = 10;    /* i: waiting for dictionary check value */
const    DICT = 11;      /* waiting for inflateSetDictionary() call */
const        TYPE = 12;      /* i: waiting for type bits, including last-flag bit */
const        TYPEDO = 13;    /* i: same, but skip check to exit inflate on new block */
const        STORED = 14;    /* i: waiting for stored size (length and complement) */
const        COPY_ = 15;     /* i/o: same as COPY below, but only first time in */
const        COPY = 16;      /* i/o: waiting for input or output to copy stored block */
const        TABLE = 17;     /* i: waiting for dynamic block table lengths */
const        LENLENS = 18;   /* i: waiting for code length code lengths */
const        CODELENS = 19;  /* i: waiting for length/lit and distance code lengths */
const            LEN_ = 20;      /* i: same as LEN below, but only first time in */
const            LEN = 21;       /* i: waiting for length/lit/eob code */
const            LENEXT = 22;    /* i: waiting for length extra bits */
const            DIST = 23;      /* i: waiting for distance code */
const            DISTEXT = 24;   /* i: waiting for distance extra bits */
const            MATCH = 25;     /* o: waiting for output space to copy string */
const            LIT = 26;       /* o: waiting for output space to write literal */
const    CHECK = 27;     /* i: waiting for 32-bit check value */
const    LENGTH$2 = 28;    /* i: waiting for 32-bit length (gzip) */
const    DONE = 29;      /* finished check, done -- remain here until reset */
const    BAD = 30;       /* got a data error -- remain here until reset */
const    MEM = 31;       /* got an inflate() memory error -- remain here until reset */
const    SYNC = 32;      /* looking for synchronization bytes to restart inflate() */

/* ===========================================================================*/



const ENOUGH_LENS = 852;
const ENOUGH_DISTS = 592;
//const ENOUGH =  (ENOUGH_LENS+ENOUGH_DISTS);

const MAX_WBITS = 15;
/* 32K LZ77 window */
const DEF_WBITS = MAX_WBITS;


const zswap32 = (q) => {

  return  (((q >>> 24) & 0xff) +
          ((q >>> 8) & 0xff00) +
          ((q & 0xff00) << 8) +
          ((q & 0xff) << 24));
};


function InflateState() {
  this.mode = 0;             /* current inflate mode */
  this.last = false;          /* true if processing last block */
  this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
  this.havedict = false;      /* true if dictionary provided */
  this.flags = 0;             /* gzip header method and flags (0 if zlib) */
  this.dmax = 0;              /* zlib header max distance (INFLATE_STRICT) */
  this.check = 0;             /* protected copy of check value */
  this.total = 0;             /* protected copy of output count */
  // TODO: may be {}
  this.head = null;           /* where to save gzip header information */

  /* sliding window */
  this.wbits = 0;             /* log base 2 of requested window size */
  this.wsize = 0;             /* window size or zero if not using window */
  this.whave = 0;             /* valid bytes in the window */
  this.wnext = 0;             /* window write index */
  this.window = null;         /* allocated sliding window, if needed */

  /* bit accumulator */
  this.hold = 0;              /* input bit accumulator */
  this.bits = 0;              /* number of bits in "in" */

  /* for string and stored block copying */
  this.length = 0;            /* literal or length of data to copy */
  this.offset = 0;            /* distance back to copy string from */

  /* for table and code decoding */
  this.extra = 0;             /* extra bits needed */

  /* fixed and dynamic code tables */
  this.lencode = null;          /* starting table for length/literal codes */
  this.distcode = null;         /* starting table for distance codes */
  this.lenbits = 0;           /* index bits for lencode */
  this.distbits = 0;          /* index bits for distcode */

  /* dynamic table building */
  this.ncode = 0;             /* number of code length code lengths */
  this.nlen = 0;              /* number of length code lengths */
  this.ndist = 0;             /* number of distance code lengths */
  this.have = 0;              /* number of code lengths in lens[] */
  this.next = null;              /* next available space in codes[] */

  this.lens = new Uint16Array(320); /* temporary storage for code lengths */
  this.work = new Uint16Array(288); /* work area for code table building */

  /*
   because we don't have pointers in js, we use lencode and distcode directly
   as buffers so we don't need codes
  */
  //this.codes = new Int32Array(ENOUGH);       /* space for code tables */
  this.lendyn = null;              /* dynamic table for length/literal codes (JS specific) */
  this.distdyn = null;             /* dynamic table for distance codes (JS specific) */
  this.sane = 0;                   /* if false, allow invalid distance too far */
  this.back = 0;                   /* bits back of last unprocessed length/lit */
  this.was = 0;                    /* initial length of match */
}


const inflateResetKeep = (strm) => {

  if (!strm || !strm.state) { return Z_STREAM_ERROR$1; }
  const state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = ''; /*Z_NULL*/
  if (state.wrap) {       /* to support ill-conceived Java test suite */
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.dmax = 32768;
  state.head = null/*Z_NULL*/;
  state.hold = 0;
  state.bits = 0;
  //state.lencode = state.distcode = state.next = state.codes;
  state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS);
  state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS);

  state.sane = 1;
  state.back = -1;
  //Tracev((stderr, "inflate: reset\n"));
  return Z_OK$1;
};


const inflateReset = (strm) => {

  if (!strm || !strm.state) { return Z_STREAM_ERROR$1; }
  const state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);

};


const inflateReset2 = (strm, windowBits) => {
  let wrap;

  /* get the state */
  if (!strm || !strm.state) { return Z_STREAM_ERROR$1; }
  const state = strm.state;

  /* extract wrap request from windowBits parameter */
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  }
  else {
    wrap = (windowBits >> 4) + 1;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }

  /* set number of window bits, free window if different */
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR$1;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }

  /* update state and reset the rest of it */
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
};


const inflateInit2 = (strm, windowBits) => {

  if (!strm) { return Z_STREAM_ERROR$1; }
  //strm.msg = Z_NULL;                 /* in case we return an error */

  const state = new InflateState();

  //if (state === Z_NULL) return Z_MEM_ERROR;
  //Tracev((stderr, "inflate: allocated\n"));
  strm.state = state;
  state.window = null/*Z_NULL*/;
  const ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK$1) {
    strm.state = null/*Z_NULL*/;
  }
  return ret;
};


const inflateInit = (strm) => {

  return inflateInit2(strm, DEF_WBITS);
};


/*
 Return state with length and distance decoding tables and index sizes set to
 fixed code decoding.  Normally this returns fixed tables from inffixed.h.
 If BUILDFIXED is defined, then instead this routine builds the tables the
 first time it's called, and returns those tables the first time and
 thereafter.  This reduces the size of the code by about 2K bytes, in
 exchange for a little execution time.  However, BUILDFIXED should not be
 used for threaded applications, since the rewriting of the tables and virgin
 may not be thread-safe.
 */
let virgin = true;

let lenfix, distfix; // We have no pointers in JS, so keep tables separate


const fixedtables = (state) => {

  /* build fixed huffman tables if first call (may not be thread safe) */
  if (virgin) {
    lenfix = new Int32Array(512);
    distfix = new Int32Array(32);

    /* literal/length table */
    let sym = 0;
    while (sym < 144) { state.lens[sym++] = 8; }
    while (sym < 256) { state.lens[sym++] = 9; }
    while (sym < 280) { state.lens[sym++] = 7; }
    while (sym < 288) { state.lens[sym++] = 8; }

    inftrees(LENS,  state.lens, 0, 288, lenfix,   0, state.work, { bits: 9 });

    /* distance table */
    sym = 0;
    while (sym < 32) { state.lens[sym++] = 5; }

    inftrees(DISTS, state.lens, 0, 32,   distfix, 0, state.work, { bits: 5 });

    /* do this just once */
    virgin = false;
  }

  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
};


/*
 Update the window with the last wsize (normally 32K) bytes written before
 returning.  If window does not exist yet, create it.  This is only called
 when a window is already in use, or when output has been written during this
 inflate call, but the end of the deflate stream has not been reached yet.
 It is also called to create a window for dictionary data when a dictionary
 is loaded.

 Providing output buffers larger than 32K to inflate() should provide a speed
 advantage, since only the last 32K of output is copied to the sliding window
 upon return from inflate(), and since all distances after the first 32K of
 output will fall in the output data, making match copies simpler and faster.
 The advantage may be dependent on the size of the processor's data caches.
 */
const updatewindow = (strm, src, end, copy) => {

  let dist;
  const state = strm.state;

  /* if it hasn't been done already, allocate space for the window */
  if (state.window === null) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;

    state.window = new Uint8Array(state.wsize);
  }

  /* copy state->wsize or less output bytes into the circular window */
  if (copy >= state.wsize) {
    state.window.set(src.subarray(end - state.wsize, end), 0);
    state.wnext = 0;
    state.whave = state.wsize;
  }
  else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    //zmemcpy(state->window + state->wnext, end - copy, dist);
    state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
    copy -= dist;
    if (copy) {
      //zmemcpy(state->window, end - copy, copy);
      state.window.set(src.subarray(end - copy, end), 0);
      state.wnext = copy;
      state.whave = state.wsize;
    }
    else {
      state.wnext += dist;
      if (state.wnext === state.wsize) { state.wnext = 0; }
      if (state.whave < state.wsize) { state.whave += dist; }
    }
  }
  return 0;
};


const inflate$2 = (strm, flush) => {

  let state;
  let input, output;          // input/output buffers
  let next;                   /* next input INDEX */
  let put;                    /* next output INDEX */
  let have, left;             /* available input and output */
  let hold;                   /* bit buffer */
  let bits;                   /* bits in bit buffer */
  let _in, _out;              /* save starting available input and output */
  let copy;                   /* number of stored or match bytes to copy */
  let from;                   /* where to copy match bytes from */
  let from_source;
  let here = 0;               /* current decoding table entry */
  let here_bits, here_op, here_val; // paked "here" denormalized (JS specific)
  //let last;                   /* parent table entry */
  let last_bits, last_op, last_val; // paked "last" denormalized (JS specific)
  let len;                    /* length to copy for repeats, bits to drop */
  let ret;                    /* return code */
  const hbuf = new Uint8Array(4);    /* buffer for gzip header crc calculation */
  let opts;

  let n; // temporary variable for NEED_BITS

  const order = /* permutation of code lengths */
    new Uint8Array([ 16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 ]);


  if (!strm || !strm.state || !strm.output ||
      (!strm.input && strm.avail_in !== 0)) {
    return Z_STREAM_ERROR$1;
  }

  state = strm.state;
  if (state.mode === TYPE) { state.mode = TYPEDO; }    /* skip check */


  //--- LOAD() ---
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  //---

  _in = have;
  _out = left;
  ret = Z_OK$1;

  inf_leave: // goto emulation
  for (;;) {
    switch (state.mode) {
      case HEAD:
        if (state.wrap === 0) {
          state.mode = TYPEDO;
          break;
        }
        //=== NEEDBITS(16);
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if ((state.wrap & 2) && hold === 0x8b1f) {  /* gzip header */
          state.check = 0/*crc32(0L, Z_NULL, 0)*/;
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32_1(state.check, hbuf, 2, 0);
          //===//

          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = FLAGS;
          break;
        }
        state.flags = 0;           /* expect zlib header */
        if (state.head) {
          state.head.done = false;
        }
        if (!(state.wrap & 1) ||   /* check if zlib header allowed */
          (((hold & 0xff)/*BITS(8)*/ << 8) + (hold >> 8)) % 31) {
          strm.msg = 'incorrect header check';
          state.mode = BAD;
          break;
        }
        if ((hold & 0x0f)/*BITS(4)*/ !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        //--- DROPBITS(4) ---//
        hold >>>= 4;
        bits -= 4;
        //---//
        len = (hold & 0x0f)/*BITS(4)*/ + 8;
        if (state.wbits === 0) {
          state.wbits = len;
        }
        else if (len > state.wbits) {
          strm.msg = 'invalid window size';
          state.mode = BAD;
          break;
        }

        // !!! pako patch. Force use `options.windowBits` if passed.
        // Required to always use max window size by default.
        state.dmax = 1 << state.wbits;
        //state.dmax = 1 << len;

        //Tracev((stderr, "inflate:   zlib header ok\n"));
        strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
        state.mode = hold & 0x200 ? DICTID : TYPE;
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        break;
      case FLAGS:
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.flags = hold;
        if ((state.flags & 0xff) !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        if (state.flags & 0xe000) {
          strm.msg = 'unknown header flags set';
          state.mode = BAD;
          break;
        }
        if (state.head) {
          state.head.text = ((hold >> 8) & 1);
        }
        if (state.flags & 0x0200) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32_1(state.check, hbuf, 2, 0);
          //===//
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = TIME;
        /* falls through */
      case TIME:
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (state.head) {
          state.head.time = hold;
        }
        if (state.flags & 0x0200) {
          //=== CRC4(state.check, hold)
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          hbuf[2] = (hold >>> 16) & 0xff;
          hbuf[3] = (hold >>> 24) & 0xff;
          state.check = crc32_1(state.check, hbuf, 4, 0);
          //===
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = OS;
        /* falls through */
      case OS:
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (state.head) {
          state.head.xflags = (hold & 0xff);
          state.head.os = (hold >> 8);
        }
        if (state.flags & 0x0200) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32_1(state.check, hbuf, 2, 0);
          //===//
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = EXLEN;
        /* falls through */
      case EXLEN:
        if (state.flags & 0x0400) {
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.length = hold;
          if (state.head) {
            state.head.extra_len = hold;
          }
          if (state.flags & 0x0200) {
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            state.check = crc32_1(state.check, hbuf, 2, 0);
            //===//
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
        }
        else if (state.head) {
          state.head.extra = null/*Z_NULL*/;
        }
        state.mode = EXTRA;
        /* falls through */
      case EXTRA:
        if (state.flags & 0x0400) {
          copy = state.length;
          if (copy > have) { copy = have; }
          if (copy) {
            if (state.head) {
              len = state.head.extra_len - state.length;
              if (!state.head.extra) {
                // Use untyped array for more convenient processing later
                state.head.extra = new Uint8Array(state.head.extra_len);
              }
              state.head.extra.set(
                input.subarray(
                  next,
                  // extra field is limited to 65536 bytes
                  // - no need for additional size check
                  next + copy
                ),
                /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                len
              );
              //zmemcpy(state.head.extra + len, next,
              //        len + copy > state.head.extra_max ?
              //        state.head.extra_max - len : copy);
            }
            if (state.flags & 0x0200) {
              state.check = crc32_1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            state.length -= copy;
          }
          if (state.length) { break inf_leave; }
        }
        state.length = 0;
        state.mode = NAME;
        /* falls through */
      case NAME:
        if (state.flags & 0x0800) {
          if (have === 0) { break inf_leave; }
          copy = 0;
          do {
            // TODO: 2 or 1 bytes?
            len = input[next + copy++];
            /* use constant limit because in js we should not preallocate memory */
            if (state.head && len &&
                (state.length < 65536 /*state.head.name_max*/)) {
              state.head.name += String.fromCharCode(len);
            }
          } while (len && copy < have);

          if (state.flags & 0x0200) {
            state.check = crc32_1(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) { break inf_leave; }
        }
        else if (state.head) {
          state.head.name = null;
        }
        state.length = 0;
        state.mode = COMMENT;
        /* falls through */
      case COMMENT:
        if (state.flags & 0x1000) {
          if (have === 0) { break inf_leave; }
          copy = 0;
          do {
            len = input[next + copy++];
            /* use constant limit because in js we should not preallocate memory */
            if (state.head && len &&
                (state.length < 65536 /*state.head.comm_max*/)) {
              state.head.comment += String.fromCharCode(len);
            }
          } while (len && copy < have);
          if (state.flags & 0x0200) {
            state.check = crc32_1(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) { break inf_leave; }
        }
        else if (state.head) {
          state.head.comment = null;
        }
        state.mode = HCRC;
        /* falls through */
      case HCRC:
        if (state.flags & 0x0200) {
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if (hold !== (state.check & 0xffff)) {
            strm.msg = 'header crc mismatch';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
        }
        if (state.head) {
          state.head.hcrc = ((state.flags >> 9) & 1);
          state.head.done = true;
        }
        strm.adler = state.check = 0;
        state.mode = TYPE;
        break;
      case DICTID:
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        strm.adler = state.check = zswap32(hold);
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = DICT;
        /* falls through */
      case DICT:
        if (state.havedict === 0) {
          //--- RESTORE() ---
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          //---
          return Z_NEED_DICT$1;
        }
        strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
        state.mode = TYPE;
        /* falls through */
      case TYPE:
        if (flush === Z_BLOCK || flush === Z_TREES) { break inf_leave; }
        /* falls through */
      case TYPEDO:
        if (state.last) {
          //--- BYTEBITS() ---//
          hold >>>= bits & 7;
          bits -= bits & 7;
          //---//
          state.mode = CHECK;
          break;
        }
        //=== NEEDBITS(3); */
        while (bits < 3) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.last = (hold & 0x01)/*BITS(1)*/;
        //--- DROPBITS(1) ---//
        hold >>>= 1;
        bits -= 1;
        //---//

        switch ((hold & 0x03)/*BITS(2)*/) {
          case 0:                             /* stored block */
            //Tracev((stderr, "inflate:     stored block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = STORED;
            break;
          case 1:                             /* fixed block */
            fixedtables(state);
            //Tracev((stderr, "inflate:     fixed codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = LEN_;             /* decode codes */
            if (flush === Z_TREES) {
              //--- DROPBITS(2) ---//
              hold >>>= 2;
              bits -= 2;
              //---//
              break inf_leave;
            }
            break;
          case 2:                             /* dynamic block */
            //Tracev((stderr, "inflate:     dynamic codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = TABLE;
            break;
          case 3:
            strm.msg = 'invalid block type';
            state.mode = BAD;
        }
        //--- DROPBITS(2) ---//
        hold >>>= 2;
        bits -= 2;
        //---//
        break;
      case STORED:
        //--- BYTEBITS() ---// /* go to byte boundary */
        hold >>>= bits & 7;
        bits -= bits & 7;
        //---//
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
          strm.msg = 'invalid stored block lengths';
          state.mode = BAD;
          break;
        }
        state.length = hold & 0xffff;
        //Tracev((stderr, "inflate:       stored length %u\n",
        //        state.length));
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = COPY_;
        if (flush === Z_TREES) { break inf_leave; }
        /* falls through */
      case COPY_:
        state.mode = COPY;
        /* falls through */
      case COPY:
        copy = state.length;
        if (copy) {
          if (copy > have) { copy = have; }
          if (copy > left) { copy = left; }
          if (copy === 0) { break inf_leave; }
          //--- zmemcpy(put, next, copy); ---
          output.set(input.subarray(next, next + copy), put);
          //---//
          have -= copy;
          next += copy;
          left -= copy;
          put += copy;
          state.length -= copy;
          break;
        }
        //Tracev((stderr, "inflate:       stored end\n"));
        state.mode = TYPE;
        break;
      case TABLE:
        //=== NEEDBITS(14); */
        while (bits < 14) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.nlen = (hold & 0x1f)/*BITS(5)*/ + 257;
        //--- DROPBITS(5) ---//
        hold >>>= 5;
        bits -= 5;
        //---//
        state.ndist = (hold & 0x1f)/*BITS(5)*/ + 1;
        //--- DROPBITS(5) ---//
        hold >>>= 5;
        bits -= 5;
        //---//
        state.ncode = (hold & 0x0f)/*BITS(4)*/ + 4;
        //--- DROPBITS(4) ---//
        hold >>>= 4;
        bits -= 4;
        //---//
//#ifndef PKZIP_BUG_WORKAROUND
        if (state.nlen > 286 || state.ndist > 30) {
          strm.msg = 'too many length or distance symbols';
          state.mode = BAD;
          break;
        }
//#endif
        //Tracev((stderr, "inflate:       table sizes ok\n"));
        state.have = 0;
        state.mode = LENLENS;
        /* falls through */
      case LENLENS:
        while (state.have < state.ncode) {
          //=== NEEDBITS(3);
          while (bits < 3) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.lens[order[state.have++]] = (hold & 0x07);//BITS(3);
          //--- DROPBITS(3) ---//
          hold >>>= 3;
          bits -= 3;
          //---//
        }
        while (state.have < 19) {
          state.lens[order[state.have++]] = 0;
        }
        // We have separate tables & no pointers. 2 commented lines below not needed.
        //state.next = state.codes;
        //state.lencode = state.next;
        // Switch to use dynamic table
        state.lencode = state.lendyn;
        state.lenbits = 7;

        opts = { bits: state.lenbits };
        ret = inftrees(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
        state.lenbits = opts.bits;

        if (ret) {
          strm.msg = 'invalid code lengths set';
          state.mode = BAD;
          break;
        }
        //Tracev((stderr, "inflate:       code lengths ok\n"));
        state.have = 0;
        state.mode = CODELENS;
        /* falls through */
      case CODELENS:
        while (state.have < state.nlen + state.ndist) {
          for (;;) {
            here = state.lencode[hold & ((1 << state.lenbits) - 1)];/*BITS(state.lenbits)*/
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((here_bits) <= bits) { break; }
            //--- PULLBYTE() ---//
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          if (here_val < 16) {
            //--- DROPBITS(here.bits) ---//
            hold >>>= here_bits;
            bits -= here_bits;
            //---//
            state.lens[state.have++] = here_val;
          }
          else {
            if (here_val === 16) {
              //=== NEEDBITS(here.bits + 2);
              n = here_bits + 2;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              if (state.have === 0) {
                strm.msg = 'invalid bit length repeat';
                state.mode = BAD;
                break;
              }
              len = state.lens[state.have - 1];
              copy = 3 + (hold & 0x03);//BITS(2);
              //--- DROPBITS(2) ---//
              hold >>>= 2;
              bits -= 2;
              //---//
            }
            else if (here_val === 17) {
              //=== NEEDBITS(here.bits + 3);
              n = here_bits + 3;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              len = 0;
              copy = 3 + (hold & 0x07);//BITS(3);
              //--- DROPBITS(3) ---//
              hold >>>= 3;
              bits -= 3;
              //---//
            }
            else {
              //=== NEEDBITS(here.bits + 7);
              n = here_bits + 7;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              len = 0;
              copy = 11 + (hold & 0x7f);//BITS(7);
              //--- DROPBITS(7) ---//
              hold >>>= 7;
              bits -= 7;
              //---//
            }
            if (state.have + copy > state.nlen + state.ndist) {
              strm.msg = 'invalid bit length repeat';
              state.mode = BAD;
              break;
            }
            while (copy--) {
              state.lens[state.have++] = len;
            }
          }
        }

        /* handle error breaks in while */
        if (state.mode === BAD) { break; }

        /* check for end-of-block code (better have one) */
        if (state.lens[256] === 0) {
          strm.msg = 'invalid code -- missing end-of-block';
          state.mode = BAD;
          break;
        }

        /* build code tables -- note: do not change the lenbits or distbits
           values here (9 and 6) without reading the comments in inftrees.h
           concerning the ENOUGH constants, which depend on those values */
        state.lenbits = 9;

        opts = { bits: state.lenbits };
        ret = inftrees(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
        // We have separate tables & no pointers. 2 commented lines below not needed.
        // state.next_index = opts.table_index;
        state.lenbits = opts.bits;
        // state.lencode = state.next;

        if (ret) {
          strm.msg = 'invalid literal/lengths set';
          state.mode = BAD;
          break;
        }

        state.distbits = 6;
        //state.distcode.copy(state.codes);
        // Switch to use dynamic table
        state.distcode = state.distdyn;
        opts = { bits: state.distbits };
        ret = inftrees(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
        // We have separate tables & no pointers. 2 commented lines below not needed.
        // state.next_index = opts.table_index;
        state.distbits = opts.bits;
        // state.distcode = state.next;

        if (ret) {
          strm.msg = 'invalid distances set';
          state.mode = BAD;
          break;
        }
        //Tracev((stderr, 'inflate:       codes ok\n'));
        state.mode = LEN_;
        if (flush === Z_TREES) { break inf_leave; }
        /* falls through */
      case LEN_:
        state.mode = LEN;
        /* falls through */
      case LEN:
        if (have >= 6 && left >= 258) {
          //--- RESTORE() ---
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          //---
          inffast(strm, _out);
          //--- LOAD() ---
          put = strm.next_out;
          output = strm.output;
          left = strm.avail_out;
          next = strm.next_in;
          input = strm.input;
          have = strm.avail_in;
          hold = state.hold;
          bits = state.bits;
          //---

          if (state.mode === TYPE) {
            state.back = -1;
          }
          break;
        }
        state.back = 0;
        for (;;) {
          here = state.lencode[hold & ((1 << state.lenbits) - 1)];  /*BITS(state.lenbits)*/
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if (here_bits <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        if (here_op && (here_op & 0xf0) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.lencode[last_val +
                    ((hold & ((1 << (last_bits + last_op)) - 1))/*BITS(last.bits + last.op)*/ >> last_bits)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((last_bits + here_bits) <= bits) { break; }
            //--- PULLBYTE() ---//
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          //--- DROPBITS(last.bits) ---//
          hold >>>= last_bits;
          bits -= last_bits;
          //---//
          state.back += last_bits;
        }
        //--- DROPBITS(here.bits) ---//
        hold >>>= here_bits;
        bits -= here_bits;
        //---//
        state.back += here_bits;
        state.length = here_val;
        if (here_op === 0) {
          //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
          //        "inflate:         literal '%c'\n" :
          //        "inflate:         literal 0x%02x\n", here.val));
          state.mode = LIT;
          break;
        }
        if (here_op & 32) {
          //Tracevv((stderr, "inflate:         end of block\n"));
          state.back = -1;
          state.mode = TYPE;
          break;
        }
        if (here_op & 64) {
          strm.msg = 'invalid literal/length code';
          state.mode = BAD;
          break;
        }
        state.extra = here_op & 15;
        state.mode = LENEXT;
        /* falls through */
      case LENEXT:
        if (state.extra) {
          //=== NEEDBITS(state.extra);
          n = state.extra;
          while (bits < n) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.length += hold & ((1 << state.extra) - 1)/*BITS(state.extra)*/;
          //--- DROPBITS(state.extra) ---//
          hold >>>= state.extra;
          bits -= state.extra;
          //---//
          state.back += state.extra;
        }
        //Tracevv((stderr, "inflate:         length %u\n", state.length));
        state.was = state.length;
        state.mode = DIST;
        /* falls through */
      case DIST:
        for (;;) {
          here = state.distcode[hold & ((1 << state.distbits) - 1)];/*BITS(state.distbits)*/
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if ((here_bits) <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        if ((here_op & 0xf0) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.distcode[last_val +
                    ((hold & ((1 << (last_bits + last_op)) - 1))/*BITS(last.bits + last.op)*/ >> last_bits)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((last_bits + here_bits) <= bits) { break; }
            //--- PULLBYTE() ---//
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          //--- DROPBITS(last.bits) ---//
          hold >>>= last_bits;
          bits -= last_bits;
          //---//
          state.back += last_bits;
        }
        //--- DROPBITS(here.bits) ---//
        hold >>>= here_bits;
        bits -= here_bits;
        //---//
        state.back += here_bits;
        if (here_op & 64) {
          strm.msg = 'invalid distance code';
          state.mode = BAD;
          break;
        }
        state.offset = here_val;
        state.extra = (here_op) & 15;
        state.mode = DISTEXT;
        /* falls through */
      case DISTEXT:
        if (state.extra) {
          //=== NEEDBITS(state.extra);
          n = state.extra;
          while (bits < n) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.offset += hold & ((1 << state.extra) - 1)/*BITS(state.extra)*/;
          //--- DROPBITS(state.extra) ---//
          hold >>>= state.extra;
          bits -= state.extra;
          //---//
          state.back += state.extra;
        }
//#ifdef INFLATE_STRICT
        if (state.offset > state.dmax) {
          strm.msg = 'invalid distance too far back';
          state.mode = BAD;
          break;
        }
//#endif
        //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
        state.mode = MATCH;
        /* falls through */
      case MATCH:
        if (left === 0) { break inf_leave; }
        copy = _out - left;
        if (state.offset > copy) {         /* copy from window */
          copy = state.offset - copy;
          if (copy > state.whave) {
            if (state.sane) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD;
              break;
            }
// (!) This block is disabled in zlib defaults,
// don't enable it for binary compatibility
//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
//          Trace((stderr, "inflate.c too far\n"));
//          copy -= state.whave;
//          if (copy > state.length) { copy = state.length; }
//          if (copy > left) { copy = left; }
//          left -= copy;
//          state.length -= copy;
//          do {
//            output[put++] = 0;
//          } while (--copy);
//          if (state.length === 0) { state.mode = LEN; }
//          break;
//#endif
          }
          if (copy > state.wnext) {
            copy -= state.wnext;
            from = state.wsize - copy;
          }
          else {
            from = state.wnext - copy;
          }
          if (copy > state.length) { copy = state.length; }
          from_source = state.window;
        }
        else {                              /* copy from output */
          from_source = output;
          from = put - state.offset;
          copy = state.length;
        }
        if (copy > left) { copy = left; }
        left -= copy;
        state.length -= copy;
        do {
          output[put++] = from_source[from++];
        } while (--copy);
        if (state.length === 0) { state.mode = LEN; }
        break;
      case LIT:
        if (left === 0) { break inf_leave; }
        output[put++] = state.length;
        left--;
        state.mode = LEN;
        break;
      case CHECK:
        if (state.wrap) {
          //=== NEEDBITS(32);
          while (bits < 32) {
            if (have === 0) { break inf_leave; }
            have--;
            // Use '|' instead of '+' to make sure that result is signed
            hold |= input[next++] << bits;
            bits += 8;
          }
          //===//
          _out -= left;
          strm.total_out += _out;
          state.total += _out;
          if (_out) {
            strm.adler = state.check =
                /*UPDATE(state.check, put - _out, _out);*/
                (state.flags ? crc32_1(state.check, output, _out, put - _out) : adler32_1(state.check, output, _out, put - _out));

          }
          _out = left;
          // NB: crc32 stored as signed 32-bit int, zswap32 returns signed too
          if ((state.flags ? hold : zswap32(hold)) !== state.check) {
            strm.msg = 'incorrect data check';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          //Tracev((stderr, "inflate:   check matches trailer\n"));
        }
        state.mode = LENGTH$2;
        /* falls through */
      case LENGTH$2:
        if (state.wrap && state.flags) {
          //=== NEEDBITS(32);
          while (bits < 32) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if (hold !== (state.total & 0xffffffff)) {
            strm.msg = 'incorrect length check';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          //Tracev((stderr, "inflate:   length matches trailer\n"));
        }
        state.mode = DONE;
        /* falls through */
      case DONE:
        ret = Z_STREAM_END$1;
        break inf_leave;
      case BAD:
        ret = Z_DATA_ERROR$1;
        break inf_leave;
      case MEM:
        return Z_MEM_ERROR$1;
      case SYNC:
        /* falls through */
      default:
        return Z_STREAM_ERROR$1;
    }
  }

  // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

  /*
     Return from inflate(), updating the total counts and the check value.
     If there was no progress during the inflate() call, return a buffer
     error.  Call updatewindow() to create and/or update the window state.
     Note: a memory error from inflate() is non-recoverable.
   */

  //--- RESTORE() ---
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  //---

  if (state.wsize || (_out !== strm.avail_out && state.mode < BAD &&
                      (state.mode < CHECK || flush !== Z_FINISH$1))) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) ;
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap && _out) {
    strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
      (state.flags ? crc32_1(state.check, output, _out, strm.next_out - _out) : adler32_1(state.check, output, _out, strm.next_out - _out));
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) +
                    (state.mode === TYPE ? 128 : 0) +
                    (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if (((_in === 0 && _out === 0) || flush === Z_FINISH$1) && ret === Z_OK$1) {
    ret = Z_BUF_ERROR;
  }
  return ret;
};


const inflateEnd = (strm) => {

  if (!strm || !strm.state /*|| strm->zfree == (free_func)0*/) {
    return Z_STREAM_ERROR$1;
  }

  let state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK$1;
};


const inflateGetHeader = (strm, head) => {

  /* check state */
  if (!strm || !strm.state) { return Z_STREAM_ERROR$1; }
  const state = strm.state;
  if ((state.wrap & 2) === 0) { return Z_STREAM_ERROR$1; }

  /* save header structure */
  state.head = head;
  head.done = false;
  return Z_OK$1;
};


const inflateSetDictionary = (strm, dictionary) => {
  const dictLength = dictionary.length;

  let state;
  let dictid;
  let ret;

  /* check state */
  if (!strm /* == Z_NULL */ || !strm.state /* == Z_NULL */) { return Z_STREAM_ERROR$1; }
  state = strm.state;

  if (state.wrap !== 0 && state.mode !== DICT) {
    return Z_STREAM_ERROR$1;
  }

  /* check for correct dictionary identifier */
  if (state.mode === DICT) {
    dictid = 1; /* adler32(0, null, 0)*/
    /* dictid = adler32(dictid, dictionary, dictLength); */
    dictid = adler32_1(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) {
      return Z_DATA_ERROR$1;
    }
  }
  /* copy dictionary to window using updatewindow(), which will amend the
   existing dictionary if appropriate */
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return Z_MEM_ERROR$1;
  }
  state.havedict = 1;
  // Tracev((stderr, "inflate:   dictionary set\n"));
  return Z_OK$1;
};


var inflateReset_1 = inflateReset;
var inflateReset2_1 = inflateReset2;
var inflateResetKeep_1 = inflateResetKeep;
var inflateInit_1 = inflateInit;
var inflateInit2_1 = inflateInit2;
var inflate_2$1 = inflate$2;
var inflateEnd_1 = inflateEnd;
var inflateGetHeader_1 = inflateGetHeader;
var inflateSetDictionary_1 = inflateSetDictionary;
var inflateInfo = 'pako inflate (from Nodeca project)';

/* Not implemented
module.exports.inflateCopy = inflateCopy;
module.exports.inflateGetDictionary = inflateGetDictionary;
module.exports.inflateMark = inflateMark;
module.exports.inflatePrime = inflatePrime;
module.exports.inflateSync = inflateSync;
module.exports.inflateSyncPoint = inflateSyncPoint;
module.exports.inflateUndermine = inflateUndermine;
*/

var inflate_1$2 = {
	inflateReset: inflateReset_1,
	inflateReset2: inflateReset2_1,
	inflateResetKeep: inflateResetKeep_1,
	inflateInit: inflateInit_1,
	inflateInit2: inflateInit2_1,
	inflate: inflate_2$1,
	inflateEnd: inflateEnd_1,
	inflateGetHeader: inflateGetHeader_1,
	inflateSetDictionary: inflateSetDictionary_1,
	inflateInfo: inflateInfo
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function GZheader() {
  /* true if compressed data believed to be text */
  this.text       = 0;
  /* modification time */
  this.time       = 0;
  /* extra flags (not used when writing a gzip file) */
  this.xflags     = 0;
  /* operating system */
  this.os         = 0;
  /* pointer to extra field or Z_NULL if none */
  this.extra      = null;
  /* extra field length (valid if extra != Z_NULL) */
  this.extra_len  = 0; // Actually, we don't need it in JS,
                       // but leave for few code modifications

  //
  // Setup limits is not necessary because in js we should not preallocate memory
  // for inflate use constant limit in 65536 bytes
  //

  /* space at extra (only when reading header) */
  // this.extra_max  = 0;
  /* pointer to zero-terminated file name or Z_NULL */
  this.name       = '';
  /* space at name (only when reading header) */
  // this.name_max   = 0;
  /* pointer to zero-terminated comment or Z_NULL */
  this.comment    = '';
  /* space at comment (only when reading header) */
  // this.comm_max   = 0;
  /* true if there was or will be a header crc */
  this.hcrc       = 0;
  /* true when done reading gzip header (not used when writing a gzip file) */
  this.done       = false;
}

var gzheader = GZheader;

const toString = Object.prototype.toString;

/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
  Z_NO_FLUSH, Z_FINISH,
  Z_OK, Z_STREAM_END, Z_NEED_DICT, Z_STREAM_ERROR, Z_DATA_ERROR, Z_MEM_ERROR
} = constants$2;

/* ===========================================================================*/


/**
 * class Inflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[inflate]]
 * and [[inflateRaw]].
 **/

/* internal
 * inflate.chunks -> Array
 *
 * Chunks of output data, if [[Inflate#onData]] not overridden.
 **/

/**
 * Inflate.result -> Uint8Array|String
 *
 * Uncompressed result, generated by default [[Inflate#onData]]
 * and [[Inflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Inflate#push]] with `Z_FINISH` / `true` param).
 **/

/**
 * Inflate.err -> Number
 *
 * Error code after inflate finished. 0 (Z_OK) on success.
 * Should be checked if broken data possible.
 **/

/**
 * Inflate.msg -> String
 *
 * Error message, if [[Inflate.err]] != 0
 **/


/**
 * new Inflate(options)
 * - options (Object): zlib inflate options.
 *
 * Creates new inflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `windowBits`
 * - `dictionary`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw inflate
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 * By default, when no options set, autodetect deflate/gzip data format via
 * wrapper header.
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako')
 * const chunk1 = new Uint8Array([1,2,3,4,5,6,7,8,9])
 * const chunk2 = new Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * const inflate = new pako.Inflate({ level: 3});
 *
 * inflate.push(chunk1, false);
 * inflate.push(chunk2, true);  // true -> last chunk
 *
 * if (inflate.err) { throw new Error(inflate.err); }
 *
 * console.log(inflate.result);
 * ```
 **/
function Inflate$1(options) {
  this.options = common.assign({
    chunkSize: 1024 * 64,
    windowBits: 15,
    to: ''
  }, options || {});

  const opt = this.options;

  // Force window size for `raw` data, if not set directly,
  // because we have no header for autodetect.
  if (opt.raw && (opt.windowBits >= 0) && (opt.windowBits < 16)) {
    opt.windowBits = -opt.windowBits;
    if (opt.windowBits === 0) { opt.windowBits = -15; }
  }

  // If `windowBits` not defined (and mode not raw) - set autodetect flag for gzip/deflate
  if ((opt.windowBits >= 0) && (opt.windowBits < 16) &&
      !(options && options.windowBits)) {
    opt.windowBits += 32;
  }

  // Gzip header has no info about windows size, we can do autodetect only
  // for deflate. So, if window size not set, force it to max when gzip possible
  if ((opt.windowBits > 15) && (opt.windowBits < 48)) {
    // bit 3 (16) -> gzipped data
    // bit 4 (32) -> autodetect gzip/deflate
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15;
    }
  }

  this.err    = 0;      // error code, if happens (0 = Z_OK)
  this.msg    = '';     // error message
  this.ended  = false;  // used to avoid multiple onEnd() calls
  this.chunks = [];     // chunks of compressed data

  this.strm   = new zstream();
  this.strm.avail_out = 0;

  let status  = inflate_1$2.inflateInit2(
    this.strm,
    opt.windowBits
  );

  if (status !== Z_OK) {
    throw new Error(messages[status]);
  }

  this.header = new gzheader();

  inflate_1$2.inflateGetHeader(this.strm, this.header);

  // Setup dictionary
  if (opt.dictionary) {
    // Convert data if needed
    if (typeof opt.dictionary === 'string') {
      opt.dictionary = strings.string2buf(opt.dictionary);
    } else if (toString.call(opt.dictionary) === '[object ArrayBuffer]') {
      opt.dictionary = new Uint8Array(opt.dictionary);
    }
    if (opt.raw) { //In raw mode we need to set the dictionary early
      status = inflate_1$2.inflateSetDictionary(this.strm, opt.dictionary);
      if (status !== Z_OK) {
        throw new Error(messages[status]);
      }
    }
  }
}

/**
 * Inflate#push(data[, flush_mode]) -> Boolean
 * - data (Uint8Array|ArrayBuffer): input data
 * - flush_mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE
 *   flush modes. See constants. Skipped or `false` means Z_NO_FLUSH,
 *   `true` means Z_FINISH.
 *
 * Sends input data to inflate pipe, generating [[Inflate#onData]] calls with
 * new output chunks. Returns `true` on success. If end of stream detected,
 * [[Inflate#onEnd]] will be called.
 *
 * `flush_mode` is not needed for normal operation, because end of stream
 * detected automatically. You may try to use it for advanced things, but
 * this functionality was not tested.
 *
 * On fail call [[Inflate#onEnd]] with error code and return false.
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Inflate$1.prototype.push = function (data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  const dictionary = this.options.dictionary;
  let status, _flush_mode, last_avail_out;

  if (this.ended) return false;

  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH : Z_NO_FLUSH;

  // Convert data if needed
  if (toString.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }

  strm.next_in = 0;
  strm.avail_in = strm.input.length;

  for (;;) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }

    status = inflate_1$2.inflate(strm, _flush_mode);

    if (status === Z_NEED_DICT && dictionary) {
      status = inflate_1$2.inflateSetDictionary(strm, dictionary);

      if (status === Z_OK) {
        status = inflate_1$2.inflate(strm, _flush_mode);
      } else if (status === Z_DATA_ERROR) {
        // Replace code with more verbose
        status = Z_NEED_DICT;
      }
    }

    // Skip snyc markers if more data follows and not raw mode
    while (strm.avail_in > 0 &&
           status === Z_STREAM_END &&
           strm.state.wrap > 0 &&
           data[strm.next_in] !== 0)
    {
      inflate_1$2.inflateReset(strm);
      status = inflate_1$2.inflate(strm, _flush_mode);
    }

    switch (status) {
      case Z_STREAM_ERROR:
      case Z_DATA_ERROR:
      case Z_NEED_DICT:
      case Z_MEM_ERROR:
        this.onEnd(status);
        this.ended = true;
        return false;
    }

    // Remember real `avail_out` value, because we may patch out buffer content
    // to align utf8 strings boundaries.
    last_avail_out = strm.avail_out;

    if (strm.next_out) {
      if (strm.avail_out === 0 || status === Z_STREAM_END) {

        if (this.options.to === 'string') {

          let next_out_utf8 = strings.utf8border(strm.output, strm.next_out);

          let tail = strm.next_out - next_out_utf8;
          let utf8str = strings.buf2string(strm.output, next_out_utf8);

          // move tail & realign counters
          strm.next_out = tail;
          strm.avail_out = chunkSize - tail;
          if (tail) strm.output.set(strm.output.subarray(next_out_utf8, next_out_utf8 + tail), 0);

          this.onData(utf8str);

        } else {
          this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
        }
      }
    }

    // Must repeat iteration if out buffer is full
    if (status === Z_OK && last_avail_out === 0) continue;

    // Finalize if end of stream reached.
    if (status === Z_STREAM_END) {
      status = inflate_1$2.inflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return true;
    }

    if (strm.avail_in === 0) break;
  }

  return true;
};


/**
 * Inflate#onData(chunk) -> Void
 * - chunk (Uint8Array|String): output data. When string output requested,
 *   each chunk will be string.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Inflate$1.prototype.onData = function (chunk) {
  this.chunks.push(chunk);
};


/**
 * Inflate#onEnd(status) -> Void
 * - status (Number): inflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called either after you tell inflate that the input stream is
 * complete (Z_FINISH). By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Inflate$1.prototype.onEnd = function (status) {
  // On success - join
  if (status === Z_OK) {
    if (this.options.to === 'string') {
      this.result = this.chunks.join('');
    } else {
      this.result = common.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};


/**
 * inflate(data[, options]) -> Uint8Array|String
 * - data (Uint8Array): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Decompress `data` with inflate/ungzip and `options`. Autodetect
 * format via wrapper header by default. That's why we don't provide
 * separate `ungzip` method.
 *
 * Supported options are:
 *
 * - windowBits
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako');
 * const input = pako.deflate(new Uint8Array([1,2,3,4,5,6,7,8,9]));
 * let output;
 *
 * try {
 *   output = pako.inflate(input);
 * } catch (err) {
 *   console.log(err);
 * }
 * ```
 **/
function inflate$1(input, options) {
  const inflator = new Inflate$1(options);

  inflator.push(input);

  // That will never happens, if you don't cheat with options :)
  if (inflator.err) throw inflator.msg || messages[inflator.err];

  return inflator.result;
}


/**
 * inflateRaw(data[, options]) -> Uint8Array|String
 * - data (Uint8Array): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * The same as [[inflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function inflateRaw$1(input, options) {
  options = options || {};
  options.raw = true;
  return inflate$1(input, options);
}


/**
 * ungzip(data[, options]) -> Uint8Array|String
 * - data (Uint8Array): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Just shortcut to [[inflate]], because it autodetects format
 * by header.content. Done for convenience.
 **/


var Inflate_1$1 = Inflate$1;
var inflate_2 = inflate$1;
var inflateRaw_1$1 = inflateRaw$1;
var ungzip$1 = inflate$1;
var constants = constants$2;

var inflate_1$1 = {
	Inflate: Inflate_1$1,
	inflate: inflate_2,
	inflateRaw: inflateRaw_1$1,
	ungzip: ungzip$1,
	constants: constants
};

const { Deflate, deflate, deflateRaw, gzip } = deflate_1$1;

const { Inflate, inflate, inflateRaw, ungzip } = inflate_1$1;



var Deflate_1 = Deflate;
var deflate_1 = deflate;
var deflateRaw_1 = deflateRaw;
var gzip_1 = gzip;
var Inflate_1 = Inflate;
var inflate_1 = inflate;
var inflateRaw_1 = inflateRaw;
var ungzip_1 = ungzip;
var constants_1 = constants$2;

var pako = {
	Deflate: Deflate_1,
	deflate: deflate_1,
	deflateRaw: deflateRaw_1,
	gzip: gzip_1,
	Inflate: Inflate_1,
	inflate: inflate_1,
	inflateRaw: inflateRaw_1,
	ungzip: ungzip_1,
	constants: constants_1
};

function toInt(val) {
  if (isNaN(val)) {
    throw new Error("Not a number: " + val);
  } else if (typeof val == "string") {
    return parseInt(val);
  } else return val;
}

function toFloat(val) {
  if (typeof val == "string") {
    return parseFloat(val);
  } else return val;
}

var BufferStream = /*#__PURE__*/function () {
  function BufferStream(sizeOrBuffer, littleEndian) {
    _classCallCheck(this, BufferStream);

    this.buffer = typeof sizeOrBuffer == "number" ? new ArrayBuffer(sizeOrBuffer) : sizeOrBuffer;

    if (!this.buffer) {
      this.buffer = new ArrayBuffer(0);
    }

    this.view = new DataView(this.buffer);
    this.offset = 0;
    this.isLittleEndian = littleEndian || false;
    this.size = 0;
    this.encoder = new TextEncoder("utf-8");
  }

  _createClass(BufferStream, [{
    key: "setEndian",
    value: function setEndian(isLittle) {
      this.isLittleEndian = isLittle;
    }
  }, {
    key: "writeUint8",
    value: function writeUint8(value) {
      this.checkSize(1);
      this.view.setUint8(this.offset, toInt(value));
      return this.increment(1);
    }
  }, {
    key: "writeUint8Repeat",
    value: function writeUint8Repeat(value, count) {
      var v = toInt(value);
      this.checkSize(count);

      for (var i = 0; i < count; i++) {
        this.view.setUint8(this.offset + i, v);
      }

      return this.increment(count);
    }
  }, {
    key: "writeInt8",
    value: function writeInt8(value) {
      this.checkSize(1);
      this.view.setInt8(this.offset, toInt(value));
      return this.increment(1);
    }
  }, {
    key: "writeUint16",
    value: function writeUint16(value) {
      this.checkSize(2);
      this.view.setUint16(this.offset, toInt(value), this.isLittleEndian);
      return this.increment(2);
    }
  }, {
    key: "writeTwoUint16s",
    value: function writeTwoUint16s(value) {
      this.checkSize(4);
      var first = value >> 16;
      var second = value & 0xffff;
      this.view.setUint16(this.offset, toInt(first), this.isLittleEndian);
      this.view.setUint16(this.offset + 2, toInt(second), this.isLittleEndian);
      return this.increment(4);
    }
  }, {
    key: "writeInt16",
    value: function writeInt16(value) {
      this.checkSize(2);
      this.view.setInt16(this.offset, toInt(value), this.isLittleEndian);
      return this.increment(2);
    }
  }, {
    key: "writeUint32",
    value: function writeUint32(value) {
      this.checkSize(4);
      this.view.setUint32(this.offset, toInt(value), this.isLittleEndian);
      return this.increment(4);
    }
  }, {
    key: "writeInt32",
    value: function writeInt32(value) {
      this.checkSize(4);
      this.view.setInt32(this.offset, toInt(value), this.isLittleEndian);
      return this.increment(4);
    }
  }, {
    key: "writeFloat",
    value: function writeFloat(value) {
      this.checkSize(4);
      this.view.setFloat32(this.offset, toFloat(value), this.isLittleEndian);
      return this.increment(4);
    }
  }, {
    key: "writeDouble",
    value: function writeDouble(value) {
      this.checkSize(8);
      this.view.setFloat64(this.offset, toFloat(value), this.isLittleEndian);
      return this.increment(8);
    }
  }, {
    key: "writeUTF8String",
    value: function writeUTF8String(value) {
      var encodedString = this.encoder.encode(value);
      this.checkSize(encodedString.byteLength);
      new Uint8Array(this.buffer).set(encodedString, this.offset);
      return this.increment(encodedString.byteLength);
    }
  }, {
    key: "writeAsciiString",
    value: function writeAsciiString(value) {
      value = value || "";
      var len = value.length;
      this.checkSize(len);
      var startOffset = this.offset;

      for (var i = 0; i < len; i++) {
        var charcode = value.charCodeAt(i);
        this.view.setUint8(startOffset + i, charcode);
      }

      return this.increment(len);
    }
  }, {
    key: "readUint32",
    value: function readUint32() {
      var val = this.view.getUint32(this.offset, this.isLittleEndian);
      this.increment(4);
      return val;
    }
  }, {
    key: "readUint16",
    value: function readUint16() {
      var val = this.view.getUint16(this.offset, this.isLittleEndian);
      this.increment(2);
      return val;
    }
  }, {
    key: "readUint8",
    value: function readUint8() {
      var val = this.view.getUint8(this.offset);
      this.increment(1);
      return val;
    }
  }, {
    key: "peekUint8",
    value: function peekUint8(offset) {
      return this.view.getUint8(this.offset + offset);
    }
  }, {
    key: "readUint8Array",
    value: function readUint8Array(length) {
      var arr = new Uint8Array(this.buffer, this.offset, length);
      this.increment(length);
      return arr;
    }
  }, {
    key: "readUint16Array",
    value: function readUint16Array(length) {
      var sixlen = length / 2,
          arr = new Uint16Array(sixlen),
          i = 0;

      while (i++ < sixlen) {
        arr[i] = this.view.getUint16(this.offset, this.isLittleEndian);
        this.offset += 2;
      }

      return arr;
    }
  }, {
    key: "readInt16",
    value: function readInt16() {
      var val = this.view.getInt16(this.offset, this.isLittleEndian);
      this.increment(2);
      return val;
    }
  }, {
    key: "readInt32",
    value: function readInt32() {
      var val = this.view.getInt32(this.offset, this.isLittleEndian);
      this.increment(4);
      return val;
    }
  }, {
    key: "readFloat",
    value: function readFloat() {
      var val = this.view.getFloat32(this.offset, this.isLittleEndian);
      this.increment(4);
      return val;
    }
  }, {
    key: "readDouble",
    value: function readDouble() {
      var val = this.view.getFloat64(this.offset, this.isLittleEndian);
      this.increment(8);
      return val;
    }
  }, {
    key: "readAsciiString",
    value: function readAsciiString(length) {
      var result = "";
      var start = this.offset;
      var end = this.offset + length;

      if (end >= this.buffer.byteLength) {
        end = this.buffer.byteLength;
      }

      for (var i = start; i < end; ++i) {
        result += String.fromCharCode(this.view.getUint8(i));
      }

      this.increment(end - start);
      return result;
    }
  }, {
    key: "readVR",
    value: function readVR() {
      var vr = String.fromCharCode(this.view.getUint8(this.offset)) + String.fromCharCode(this.view.getUint8(this.offset + 1));
      this.increment(2);
      return vr;
    }
  }, {
    key: "readEncodedString",
    value: function readEncodedString(length) {
      if (this.offset + length >= this.buffer.byteLength) {
        length = this.buffer.byteLength - this.offset;
      }

      var view = new DataView(this.buffer, this.offset, length);
      var result = this.decoder.decode(view);
      this.increment(length);
      return result;
    }
  }, {
    key: "readHex",
    value: function readHex(length) {
      var hexString = "";

      for (var i = 0; i < length; i++) {
        hexString += this.readUint8().toString(16);
      }

      return hexString;
    }
  }, {
    key: "checkSize",
    value: function checkSize(step) {
      if (this.offset + step > this.buffer.byteLength) {
        //throw new Error("Writing exceeded the size of buffer");
        //
        // Resize the buffer.
        // The idea is that when it is necessary to increase the buffer size,
        // there will likely be more bytes which need to be written to the
        // buffer in the future. Buffer allocation is costly.
        // So we increase the buffer size right now
        // by a larger amount than necessary, to reserve space for later
        // writes which then can be done much faster. The current size of
        // the buffer is the best estimate of the scale by which the size
        // should increase.
        // So approximately doubling the size of the buffer
        // (while ensuring it fits the new data) is a simple but effective strategy.
        var dstSize = this.offset + step + this.buffer.byteLength;
        var dst = new ArrayBuffer(dstSize);
        new Uint8Array(dst).set(new Uint8Array(this.buffer));
        this.buffer = dst;
        this.view = new DataView(this.buffer);
      }
    }
  }, {
    key: "concat",
    value: function concat(stream) {
      var available = this.buffer.byteLength - this.offset;

      if (stream.size > available) {
        var newbuf = new ArrayBuffer(this.offset + stream.size);
        var int8 = new Uint8Array(newbuf);
        int8.set(new Uint8Array(this.getBuffer(0, this.offset)));
        int8.set(new Uint8Array(stream.getBuffer(0, stream.size)), this.offset);
        this.buffer = newbuf;
        this.view = new DataView(this.buffer);
      } else {
        var _int = new Uint8Array(this.buffer);

        _int.set(new Uint8Array(stream.getBuffer(0, stream.size)), this.offset);
      }

      this.offset += stream.size;
      this.size = this.offset;
      return this.buffer.byteLength;
    }
  }, {
    key: "increment",
    value: function increment(step) {
      this.offset += step;

      if (this.offset > this.size) {
        this.size = this.offset;
      }

      return step;
    }
  }, {
    key: "getBuffer",
    value: function getBuffer(start, end) {
      if (!start && !end) {
        start = 0;
        end = this.size;
      }

      return this.buffer.slice(start, end);
    }
  }, {
    key: "more",
    value: function more(length) {
      if (this.offset + length > this.endOffset) {
        throw new Error("Request more than currently allocated buffer");
      }

      var newBuf = new ReadBufferStream(this.buffer, null, {
        start: this.offset,
        stop: this.offset + length
      });
      this.increment(length);
      return newBuf;
    }
  }, {
    key: "reset",
    value: function reset() {
      this.offset = 0;
      return this;
    }
  }, {
    key: "end",
    value: function end() {
      return this.offset >= this.buffer.byteLength;
    }
  }, {
    key: "toEnd",
    value: function toEnd() {
      this.offset = this.buffer.byteLength;
    }
  }]);

  return BufferStream;
}();

var ReadBufferStream = /*#__PURE__*/function (_BufferStream) {
  _inherits(ReadBufferStream, _BufferStream);

  var _super = _createSuper(ReadBufferStream);

  function ReadBufferStream(buffer, littleEndian) {
    var _this;

    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
      start: null,
      stop: null,
      noCopy: false
    };

    _classCallCheck(this, ReadBufferStream);

    _this = _super.call(this, buffer, littleEndian);
    _this.offset = options.start || 0;
    _this.size = options.stop || _this.buffer.byteLength;
    _this.noCopy = options.noCopy;
    _this.startOffset = _this.offset;
    _this.endOffset = _this.size;
    _this.decoder = new TextDecoder("latin1");
    return _this;
  }

  _createClass(ReadBufferStream, [{
    key: "setDecoder",
    value: function setDecoder(decoder) {
      this.decoder = decoder;
    }
  }, {
    key: "getBuffer",
    value: function getBuffer(start, end) {
      if (this.noCopy) {
        return new Uint8Array(this.buffer, start, end - start);
      }

      if (!start && !end) {
        start = 0;
        end = this.size;
      }

      return this.buffer.slice(start, end);
    }
  }, {
    key: "reset",
    value: function reset() {
      this.offset = this.startOffset;
      return this;
    }
  }, {
    key: "end",
    value: function end() {
      return this.offset >= this.endOffset;
    }
  }, {
    key: "toEnd",
    value: function toEnd() {
      this.offset = this.endOffset;
    }
  }, {
    key: "writeUint8",
    value: function writeUint8(value) {
      throw new Error(value, "writeUint8 not implemented");
    }
  }, {
    key: "writeUint8Repeat",
    value: function writeUint8Repeat(value, count) {
      throw new Error(value, "writeUint8Repeat not implemented");
    }
  }, {
    key: "writeInt8",
    value: function writeInt8(value) {
      throw new Error(value, "writeInt8 not implemented");
    }
  }, {
    key: "writeUint16",
    value: function writeUint16(value) {
      throw new Error(value, "writeUint16 not implemented");
    }
  }, {
    key: "writeTwoUint16s",
    value: function writeTwoUint16s(value) {
      throw new Error(value, "writeTwoUint16s not implemented");
    }
  }, {
    key: "writeInt16",
    value: function writeInt16(value) {
      throw new Error(value, "writeInt16 not implemented");
    }
  }, {
    key: "writeUint32",
    value: function writeUint32(value) {
      throw new Error(value, "writeUint32 not implemented");
    }
  }, {
    key: "writeInt32",
    value: function writeInt32(value) {
      throw new Error(value, "writeInt32 not implemented");
    }
  }, {
    key: "writeFloat",
    value: function writeFloat(value) {
      throw new Error(value, "writeFloat not implemented");
    }
  }, {
    key: "writeDouble",
    value: function writeDouble(value) {
      throw new Error(value, "writeDouble not implemented");
    }
  }, {
    key: "writeAsciiString",
    value: function writeAsciiString(value) {
      throw new Error(value, "writeAsciiString not implemented");
    }
  }, {
    key: "writeUTF8String",
    value: function writeUTF8String(value) {
      throw new Error(value, "writeUTF8String not implemented");
    }
  }, {
    key: "checkSize",
    value: function checkSize(step) {
      throw new Error(step, "checkSize not implemented");
    }
  }, {
    key: "concat",
    value: function concat(stream) {
      throw new Error(stream, "concat not implemented");
    }
  }]);

  return ReadBufferStream;
}(BufferStream);

var DeflatedReadBufferStream = /*#__PURE__*/function (_ReadBufferStream) {
  _inherits(DeflatedReadBufferStream, _ReadBufferStream);

  var _super2 = _createSuper(DeflatedReadBufferStream);

  function DeflatedReadBufferStream(stream, options) {
    _classCallCheck(this, DeflatedReadBufferStream);

    var inflatedBuffer = pako.inflateRaw(stream.getBuffer(stream.offset, stream.size));
    return _super2.call(this, inflatedBuffer.buffer, stream.littleEndian, options);
  }

  return _createClass(DeflatedReadBufferStream);
}(ReadBufferStream);

var WriteBufferStream = /*#__PURE__*/function (_BufferStream2) {
  _inherits(WriteBufferStream, _BufferStream2);

  var _super3 = _createSuper(WriteBufferStream);

  function WriteBufferStream(buffer, littleEndian) {
    var _this2;

    _classCallCheck(this, WriteBufferStream);

    _this2 = _super3.call(this, buffer, littleEndian);
    _this2.size = 0;
    return _this2;
  }

  return _createClass(WriteBufferStream);
}(BufferStream);

// TransferSyntaxUIDs
var IMPLICIT_LITTLE_ENDIAN = "1.2.840.10008.1.2";
var EXPLICIT_LITTLE_ENDIAN$1 = "1.2.840.10008.1.2.1";
var DEFLATED_EXPLICIT_LITTLE_ENDIAN = "1.2.840.10008.1.2.1.99";
var EXPLICIT_BIG_ENDIAN = "1.2.840.10008.1.2.2"; // Data Element Length


var handler = {
  /**
   * Get a proxied value from the array or property value
   * Note that the property value get works even if you update the underlying object.
   * Also, return true of proxy.__isProxy in order to distinguish proxies and not double proxy them.
   */
  get: function get(target, prop) {
    if (prop == "__isProxy") return true;
    if (prop in target) return target[prop];
    return target[0][prop];
  },
  set: function set(obj, prop, value) {
    if (typeof prop === "number") {
      obj[prop] = value;
    } else if (prop in obj) {
      obj[prop] = value;
    } else {
      obj[0][prop] = value;
    }

    return true;
  }
};
/**
 * Add a proxy object for sqZero or the src[0] element if sqZero is unspecified, AND
 * src is an array of length 1.
 *
 * If sqZero isn't passed in, then assume this is a create call on the destination object
 * itself, by:
 * 1. If not an object, return dest
 * 2. If an array of length != 1, return dest
 * 3. If an array, use dest[0] as sqZero
 * 4. Use dest as sqZero
 *
 * @example
 * src = [{a:5,b:'string', c:null}]
 * addAccessors(src)
 * src.c = 'outerChange'
 * src[0].b='innerChange'
 *
 * assert src.a===5
 * assert src[0].c === 'outerChange'
 * assert src.b === 'innerChange'
 */

var addAccessors = function addAccessors(dest, sqZero) {
  if (dest.__isProxy) return dest;
  var itemZero = sqZero;

  if (itemZero === undefined) {
    if (_typeof(dest) !== "object") return dest;
    if (Array.isArray(dest) && dest.length !== 1) return dest;
    itemZero = Array.isArray(dest) ? dest[0] : dest;
  }

  var ret = [itemZero];
  return new Proxy(ret, handler);
};

function paddingLeft(paddingValue, string) {
  return String(paddingValue + string).slice(-paddingValue.length);
}

var Tag = /*#__PURE__*/function () {
  function Tag(value) {
    _classCallCheck(this, Tag);

    this.value = value;
  }

  _createClass(Tag, [{
    key: "toString",
    value: function toString() {
      return "(" + paddingLeft("0000", this.group().toString(16).toUpperCase()) + "," + paddingLeft("0000", this.element().toString(16).toUpperCase()) + ")";
    }
  }, {
    key: "toCleanString",
    value: function toCleanString() {
      return paddingLeft("0000", this.group().toString(16).toUpperCase()) + paddingLeft("0000", this.element().toString(16).toUpperCase());
    }
  }, {
    key: "is",
    value: function is(t) {
      return this.value == t;
    }
  }, {
    key: "group",
    value: function group() {
      return this.value >>> 16;
    }
  }, {
    key: "element",
    value: function element() {
      return this.value & 0xffff;
    }
  }, {
    key: "isPixelDataTag",
    value: function isPixelDataTag() {
      return this.is(0x7fe00010);
    }
  }, {
    key: "isPrivateCreator",
    value: function isPrivateCreator() {
      var group = this.group();
      var element = this.element();
      return group % 2 === 1 && element < 0x100 && element > 0x00;
    }
  }, {
    key: "write",
    value: function write(stream, vrType, values, syntax, writeOptions) {
      var vr = ValueRepresentation.createByTypeString(vrType),
          useSyntax = DicomMessage._normalizeSyntax(syntax);

      var implicit = useSyntax == IMPLICIT_LITTLE_ENDIAN ? true : false,
          isLittleEndian = useSyntax == IMPLICIT_LITTLE_ENDIAN || useSyntax == EXPLICIT_LITTLE_ENDIAN$1 ? true : false,
          isEncapsulated = this.isPixelDataTag() && DicomMessage.isEncapsulated(syntax);
      var oldEndian = stream.isLittleEndian;
      stream.setEndian(isLittleEndian);
      stream.writeUint16(this.group());
      stream.writeUint16(this.element());
      var tagStream = new WriteBufferStream(256),
          valueLength;
      tagStream.setEndian(isLittleEndian);

      if (vrType == "OW" || vrType == "OB" || vrType == "UN") {
        valueLength = vr.writeBytes(tagStream, values, useSyntax, isEncapsulated, writeOptions);
      } else if (vrType == "SQ") {
        valueLength = vr.writeBytes(tagStream, values, useSyntax, writeOptions);
      } else {
        valueLength = vr.writeBytes(tagStream, values, writeOptions);
      }

      if (vrType == "SQ") {
        valueLength = 0xffffffff;
      }

      var written = tagStream.size + 4;

      if (implicit) {
        stream.writeUint32(valueLength);
        written += 4;
      } else {
        if (vr.isExplicit()) {
          stream.writeAsciiString(vr.type);
          stream.writeUint16(0);
          stream.writeUint32(valueLength);
          written += 8;
        } else {
          stream.writeAsciiString(vr.type);
          stream.writeUint16(valueLength);
          written += 4;
        }
      }

      stream.concat(tagStream);
      stream.setEndian(oldEndian);
      return written;
    }
  }], [{
    key: "fromString",
    value: function fromString(str) {
      var group = parseInt(str.substring(0, 4), 16),
          element = parseInt(str.substring(4), 16);
      return Tag.fromNumbers(group, element);
    }
  }, {
    key: "fromPString",
    value: function fromPString(str) {
      var group = parseInt(str.substring(1, 5), 16),
          element = parseInt(str.substring(6, 10), 16);
      return Tag.fromNumbers(group, element);
    }
  }, {
    key: "fromNumbers",
    value: function fromNumbers(group, element) {
      return new Tag((group << 16 | element) >>> 0);
    }
  }, {
    key: "readTag",
    value: function readTag(stream) {
      var group = stream.readUint16(),
          element = stream.readUint16();
      return Tag.fromNumbers(group, element);
    }
  }]);

  return Tag;
}();

function rtrim(str) {
  return str.replace(/\s*$/g, "");
}

function toWindows(inputArray, size) {
  return Array.from({
    length: inputArray.length - (size - 1)
  }, //get the appropriate length
  function (_, index) {
    return inputArray.slice(index, index + size);
  } //create the windows
  );
}

var binaryVRs = ["FL", "FD", "SL", "SS", "UL", "US", "AT"],
    explicitVRs = ["OB", "OW", "OF", "SQ", "UC", "UR", "UT", "UN"],
    singleVRs$1 = ["SQ", "OF", "OW", "OB", "UN"];

var ValueRepresentation = /*#__PURE__*/function () {
  function ValueRepresentation(type) {
    _classCallCheck(this, ValueRepresentation);

    this.type = type;
    this.multi = false;
    this._isBinary = binaryVRs.indexOf(this.type) != -1;
    this._allowMultiple = !this._isBinary && singleVRs$1.indexOf(this.type) == -1;
    this._isExplicit = explicitVRs.indexOf(this.type) != -1;
  }

  _createClass(ValueRepresentation, [{
    key: "isBinary",
    value: function isBinary() {
      return this._isBinary;
    }
  }, {
    key: "allowMultiple",
    value: function allowMultiple() {
      return this._allowMultiple;
    }
  }, {
    key: "isExplicit",
    value: function isExplicit() {
      return this._isExplicit;
    }
  }, {
    key: "read",
    value: function read(stream, length, syntax) {
      if (this.fixed && this.maxLength) {
        if (!length) return this.defaultValue;
        if (this.maxLength != length) log.error("Invalid length for fixed length tag, vr " + this.type + ", length " + this.maxLength + " != " + length);
      }

      return this.readBytes(stream, length, syntax);
    }
  }, {
    key: "readBytes",
    value: function readBytes(stream, length) {
      return stream.readAsciiString(length);
    }
  }, {
    key: "readNullPaddedString",
    value: function readNullPaddedString(stream, length) {
      if (!length) return "";

      if (stream.peekUint8(length - 1) !== 0) {
        return stream.readAsciiString(length);
      } else {
        var val = stream.readAsciiString(length - 1);
        stream.increment(1);
        return val;
      }
    }
  }, {
    key: "write",
    value: function write(stream, type) {
      var args = Array.from(arguments);

      if (args[2] === null || args[2] === "" || args[2] === undefined) {
        return [stream.writeAsciiString("")];
      } else {
        var written = [],
            valueArgs = args.slice(2),
            func = stream["write" + type];

        if (Array.isArray(valueArgs[0])) {
          if (valueArgs[0].length < 1) {
            written.push(0);
          } else {
            var self = this;
            valueArgs[0].forEach(function (v, k) {
              if (self.allowMultiple() && k > 0) {
                stream.writeUint8(0x5c);
              }

              var singularArgs = [v].concat(valueArgs.slice(1));
              var byteCount = func.apply(stream, singularArgs);
              written.push(byteCount);
            });
          }
        } else {
          written.push(func.apply(stream, valueArgs));
        }

        return written;
      }
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, lengths) {
      var writeOptions = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {
        allowInvalidVRLength: false
      };
      var allowInvalidVRLength = writeOptions.allowInvalidVRLength;
      var valid = true,
          valarr = Array.isArray(value) ? value : [value],
          total = 0;

      for (var i = 0; i < valarr.length; i++) {
        var checkValue = valarr[i],
            checklen = lengths[i],
            isString = false,
            displaylen = checklen;

        if (checkValue === null || allowInvalidVRLength) {
          valid = true;
        } else if (this.checkLength) {
          valid = this.checkLength(checkValue);
        } else if (this.maxCharLength) {
          var check = this.maxCharLength; //, checklen = checkValue.length;

          valid = checkValue.length <= check;
          displaylen = checkValue.length;
          isString = true;
        } else if (this.maxLength) {
          valid = checklen <= this.maxLength;
        }

        if (!valid) {
          var errmsg = "Value exceeds max length, vr: " + this.type + ", value: " + checkValue + ", length: " + displaylen;
          if (isString) log.log(errmsg);else throw new Error(errmsg);
        }

        total += checklen;
      }

      if (this.allowMultiple()) {
        total += valarr.length ? valarr.length - 1 : 0;
      } //check for odd


      var written = total;

      if (total & 1) {
        stream.writeUint8(this.padByte);
        written++;
      }

      return written;
    }
  }], [{
    key: "createByTypeString",
    value: function createByTypeString(type) {
      var vr = VRinstances[type];

      if (vr === undefined) {
        if (type == "ox") {
          // TODO: determine VR based on context (could be 1 byte pixel data)
          // https://github.com/dgobbi/vtk-dicom/issues/38
          validationLog.error("Invalid vr type", type, "- using OW");
          vr = VRinstances["OW"];
        } else if (type == "xs") {
          validationLog.error("Invalid vr type", type, "- using US");
          vr = VRinstances["US"];
        } else {
          validationLog.error("Invalid vr type", type, "- using UN");
          vr = VRinstances["UN"];
        }
      }

      return vr;
    }
  }]);

  return ValueRepresentation;
}();

var AsciiStringRepresentation = /*#__PURE__*/function (_ValueRepresentation) {
  _inherits(AsciiStringRepresentation, _ValueRepresentation);

  var _super = _createSuper(AsciiStringRepresentation);

  function AsciiStringRepresentation(type) {
    _classCallCheck(this, AsciiStringRepresentation);

    return _super.call(this, type);
  }

  _createClass(AsciiStringRepresentation, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      return stream.readAsciiString(length);
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, writeOptions) {
      var written = _get(_getPrototypeOf(AsciiStringRepresentation.prototype), "write", this).call(this, stream, "AsciiString", value);

      return _get(_getPrototypeOf(AsciiStringRepresentation.prototype), "writeBytes", this).call(this, stream, value, written, writeOptions);
    }
  }]);

  return AsciiStringRepresentation;
}(ValueRepresentation);

var EncodedStringRepresentation = /*#__PURE__*/function (_ValueRepresentation2) {
  _inherits(EncodedStringRepresentation, _ValueRepresentation2);

  var _super2 = _createSuper(EncodedStringRepresentation);

  function EncodedStringRepresentation(type) {
    _classCallCheck(this, EncodedStringRepresentation);

    return _super2.call(this, type);
  }

  _createClass(EncodedStringRepresentation, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      return stream.readEncodedString(length);
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, writeOptions) {
      var written = _get(_getPrototypeOf(EncodedStringRepresentation.prototype), "write", this).call(this, stream, "UTF8String", value);

      return _get(_getPrototypeOf(EncodedStringRepresentation.prototype), "writeBytes", this).call(this, stream, value, written, writeOptions);
    }
  }]);

  return EncodedStringRepresentation;
}(ValueRepresentation);

var BinaryRepresentation = /*#__PURE__*/function (_ValueRepresentation3) {
  _inherits(BinaryRepresentation, _ValueRepresentation3);

  var _super3 = _createSuper(BinaryRepresentation);

  function BinaryRepresentation(type) {
    _classCallCheck(this, BinaryRepresentation);

    return _super3.call(this, type);
  }

  _createClass(BinaryRepresentation, [{
    key: "writeBytes",
    value: function writeBytes(stream, value, syntax, isEncapsulated) {
      var writeOptions = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
      var i;
      var binaryStream;
      var _writeOptions$fragmen = writeOptions.fragmentMultiframe,
          fragmentMultiframe = _writeOptions$fragmen === void 0 ? true : _writeOptions$fragmen;
      value = value === null || value === undefined ? [] : value;

      if (isEncapsulated) {
        var fragmentSize = 1024 * 20,
            frames = value.length,
            startOffset = []; // Calculate a total length for storing binary stream

        var bufferLength = 0;

        for (i = 0; i < frames; i++) {
          var needsPadding = Boolean(value[i].byteLength & 1);
          bufferLength += value[i].byteLength + (needsPadding ? 1 : 0);
          var _fragmentsLength = 1;

          if (fragmentMultiframe) {
            _fragmentsLength = Math.ceil(value[i].byteLength / fragmentSize);
          } // 8 bytes per fragment are needed to store 0xffff (2 bytes), 0xe000 (2 bytes), and frageStream size (4 bytes)


          bufferLength += _fragmentsLength * 8;
        }

        binaryStream = new WriteBufferStream(bufferLength, stream.isLittleEndian);

        for (i = 0; i < frames; i++) {
          var _needsPadding = Boolean(value[i].byteLength & 1);

          startOffset.push(binaryStream.size);
          var frameBuffer = value[i],
              frameStream = new ReadBufferStream(frameBuffer);
          var fragmentsLength = 1;

          if (fragmentMultiframe) {
            fragmentsLength = Math.ceil(frameStream.size / fragmentSize);
          }

          for (var j = 0, fragmentStart = 0; j < fragmentsLength; j++) {
            var isFinalFragment = j === fragmentsLength - 1;
            var fragmentEnd = fragmentStart + frameStream.size;

            if (fragmentMultiframe) {
              fragmentEnd = fragmentStart + fragmentSize;
            }

            if (isFinalFragment) {
              fragmentEnd = frameStream.size;
            }

            var fragStream = new ReadBufferStream(frameStream.getBuffer(fragmentStart, fragmentEnd));
            fragmentStart = fragmentEnd;
            binaryStream.writeUint16(0xfffe);
            binaryStream.writeUint16(0xe000);
            var addPaddingByte = isFinalFragment && _needsPadding;
            binaryStream.writeUint32(fragStream.size + (addPaddingByte ? 1 : 0));
            binaryStream.concat(fragStream);

            if (addPaddingByte) {
              binaryStream.writeInt8(this.padByte);
            }
          }
        }

        stream.writeUint16(0xfffe);
        stream.writeUint16(0xe000);
        stream.writeUint32(startOffset.length * 4);

        for (i = 0; i < startOffset.length; i++) {
          stream.writeUint32(startOffset[i]);
        }

        stream.concat(binaryStream);
        stream.writeUint16(0xfffe);
        stream.writeUint16(0xe0dd);
        stream.writeUint32(0x0);
        return 0xffffffff;
      } else {
        var binaryData = value[0];
        binaryStream = new ReadBufferStream(binaryData);
        stream.concat(binaryStream);
        return _get(_getPrototypeOf(BinaryRepresentation.prototype), "writeBytes", this).call(this, stream, binaryData, [binaryStream.size], writeOptions);
      }
    }
  }, {
    key: "readBytes",
    value: function readBytes(stream, length) {
      if (length == 0xffffffff) {
        var itemTagValue = Tag.readTag(stream),
            frames = [];

        if (itemTagValue.is(0xfffee000)) {
          var itemLength = stream.readUint32(),
              numOfFrames = 1,
              offsets = [];

          if (itemLength > 0x0) {
            //has frames
            numOfFrames = itemLength / 4;
            var i = 0;

            while (i++ < numOfFrames) {
              offsets.push(stream.readUint32());
            }
          } else {
            offsets = [];
          }

          var SequenceItemTag = 0xfffee000;
          var SequenceDelimiterTag = 0xfffee0dd;

          var getNextSequenceItemData = function getNextSequenceItemData(stream) {
            var nextTag = Tag.readTag(stream);

            if (nextTag.is(SequenceItemTag)) {
              var _itemLength = stream.readUint32();

              var buffer = stream.getBuffer(stream.offset, stream.offset + _itemLength);
              stream.increment(_itemLength);
              return buffer;
            } else if (nextTag.is(SequenceDelimiterTag)) {
              // Read SequenceDelimiterItem value for the SequenceDelimiterTag
              if (stream.readUint32() !== 0) {
                throw Error("SequenceDelimiterItem tag value was not zero");
              }

              return null;
            }

            throw Error("Invalid tag in sequence");
          }; // If there is an offset table, use that to loop through pixel data sequence


          if (offsets.length > 0) {
            // make offsets relative to the stream, not tag
            offsets = offsets.map(function (e) {
              return e + stream.offset;
            });
            offsets.push(stream.size); // window offsets to an array of [start,stop] locations

            frames = toWindows(offsets, 2).map(function (range) {
              var fragments = [];

              var _range = _slicedToArray(range, 2),
                  start = _range[0],
                  stop = _range[1]; // create a new readable stream based on the range


              var rangeStream = new ReadBufferStream(stream.buffer, stream.isLittleEndian, {
                start: start,
                stop: stop,
                noCopy: stream.noCopy
              });
              var frameSize = 0;

              while (!rangeStream.end()) {
                var buf = getNextSequenceItemData(rangeStream);

                if (buf === null) {
                  break;
                }

                fragments.push(buf);
                frameSize += buf.byteLength;
              } // Ensure the parent stream's offset is kept up to date


              stream.offset = rangeStream.offset; // If there's only one buffer thne just return it directly

              if (fragments.length === 1) {
                return fragments[0];
              }

              if (rangeStream.noCopy) {
                // return the fragments for downstream application to process
                return fragments;
              } else {
                // Allocate a final ArrayBuffer and concat all buffers into it
                var mergedFrame = new ArrayBuffer(frameSize);
                var u8Data = new Uint8Array(mergedFrame);
                fragments.reduce(function (offset, buffer) {
                  u8Data.set(new Uint8Array(buffer), offset);
                  return offset + buffer.byteLength;
                }, 0);
                return mergedFrame;
              }
            });
          } // If no offset table, loop through remainder of stream looking for termination tag
          else {
            while (!stream.end()) {
              var buffer = getNextSequenceItemData(stream);

              if (buffer === null) {
                break;
              }

              frames.push(buffer);
            }
          }
        } else {
          throw new Error("Item tag not found after undefined binary length");
        }

        return frames;
      } else {
        var bytes;
        /*if (this.type == 'OW') {
            bytes = stream.readUint16Array(length);
        } else if (this.type == 'OB') {
            bytes = stream.readUint8Array(length);
        }*/

        bytes = stream.getBuffer(stream.offset, stream.offset + length);
        stream.increment(length);
        return [bytes];
      }
    }
  }]);

  return BinaryRepresentation;
}(ValueRepresentation);

var ApplicationEntity = /*#__PURE__*/function (_AsciiStringRepresent) {
  _inherits(ApplicationEntity, _AsciiStringRepresent);

  var _super4 = _createSuper(ApplicationEntity);

  function ApplicationEntity() {
    var _this;

    _classCallCheck(this, ApplicationEntity);

    _this = _super4.call(this, "AE");
    _this.maxLength = 16;
    _this.padByte = 0x20;
    return _this;
  }

  _createClass(ApplicationEntity, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      return stream.readAsciiString(length).trim();
    }
  }]);

  return ApplicationEntity;
}(AsciiStringRepresentation);

var CodeString = /*#__PURE__*/function (_AsciiStringRepresent2) {
  _inherits(CodeString, _AsciiStringRepresent2);

  var _super5 = _createSuper(CodeString);

  function CodeString() {
    var _this2;

    _classCallCheck(this, CodeString);

    _this2 = _super5.call(this, "CS");
    _this2.maxLength = 16;
    _this2.padByte = 0x20;
    return _this2;
  }

  _createClass(CodeString, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      return stream.readAsciiString(length).trim();
    }
  }]);

  return CodeString;
}(AsciiStringRepresentation);

var AgeString = /*#__PURE__*/function (_AsciiStringRepresent3) {
  _inherits(AgeString, _AsciiStringRepresent3);

  var _super6 = _createSuper(AgeString);

  function AgeString() {
    var _this3;

    _classCallCheck(this, AgeString);

    _this3 = _super6.call(this, "AS");
    _this3.maxLength = 4;
    _this3.padByte = 0x20;
    _this3.fixed = true;
    _this3.defaultValue = "";
    return _this3;
  }

  return _createClass(AgeString);
}(AsciiStringRepresentation);

var AttributeTag = /*#__PURE__*/function (_ValueRepresentation4) {
  _inherits(AttributeTag, _ValueRepresentation4);

  var _super7 = _createSuper(AttributeTag);

  function AttributeTag() {
    var _this4;

    _classCallCheck(this, AttributeTag);

    _this4 = _super7.call(this, "AT");
    _this4.maxLength = 4;
    _this4.valueLength = 4;
    _this4.padByte = 0;
    _this4.fixed = true;
    return _this4;
  }

  _createClass(AttributeTag, [{
    key: "readBytes",
    value: function readBytes(stream) {
      return Tag.readTag(stream).value;
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, writeOptions) {
      return _get(_getPrototypeOf(AttributeTag.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(AttributeTag.prototype), "write", this).call(this, stream, "TwoUint16s", value), writeOptions);
    }
  }]);

  return AttributeTag;
}(ValueRepresentation);

var DateValue = /*#__PURE__*/function (_AsciiStringRepresent4) {
  _inherits(DateValue, _AsciiStringRepresent4);

  var _super8 = _createSuper(DateValue);

  function DateValue(value) {
    var _this5;

    _classCallCheck(this, DateValue);

    _this5 = _super8.call(this, "DA", value);
    _this5.maxLength = 18;
    _this5.padByte = 0x20; //this.fixed = true;

    _this5.defaultValue = "";
    return _this5;
  }

  return _createClass(DateValue);
}(AsciiStringRepresentation);

var DecimalString = /*#__PURE__*/function (_AsciiStringRepresent5) {
  _inherits(DecimalString, _AsciiStringRepresent5);

  var _super9 = _createSuper(DecimalString);

  function DecimalString() {
    var _this6;

    _classCallCheck(this, DecimalString);

    _this6 = _super9.call(this, "DS");
    _this6.maxLength = 16;
    _this6.padByte = 0x20;
    return _this6;
  }

  _createClass(DecimalString, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      var BACKSLASH = String.fromCharCode(0x5c);
      var ds = stream.readAsciiString(length);
      ds = ds.replace(/[^0-9.\\\-+e]/gi, "");

      if (ds.indexOf(BACKSLASH) !== -1) {
        // handle decimal string with multiplicity
        var dsArray = ds.split(BACKSLASH);
        ds = dsArray.map(function (ds) {
          return ds === "" ? null : Number(ds);
        });
      } else {
        ds = [ds === "" ? null : Number(ds)];
      }

      return ds;
    }
  }, {
    key: "formatValue",
    value: function formatValue(value) {
      if (value === null) {
        return "";
      }

      var str = String(value);

      if (str.length > this.maxLength) {
        return value.toExponential();
      }

      return str;
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, writeOptions) {
      var _this7 = this;

      var val = Array.isArray(value) ? value.map(function (ds) {
        return _this7.formatValue(ds);
      }) : [this.formatValue(value)];
      return _get(_getPrototypeOf(DecimalString.prototype), "writeBytes", this).call(this, stream, val, writeOptions);
    }
  }]);

  return DecimalString;
}(AsciiStringRepresentation);

var DateTime = /*#__PURE__*/function (_AsciiStringRepresent6) {
  _inherits(DateTime, _AsciiStringRepresent6);

  var _super10 = _createSuper(DateTime);

  function DateTime() {
    var _this8;

    _classCallCheck(this, DateTime);

    _this8 = _super10.call(this, "DT");
    _this8.maxLength = 26;
    _this8.padByte = 0x20;
    return _this8;
  }

  return _createClass(DateTime);
}(AsciiStringRepresentation);

var FloatingPointSingle = /*#__PURE__*/function (_ValueRepresentation5) {
  _inherits(FloatingPointSingle, _ValueRepresentation5);

  var _super11 = _createSuper(FloatingPointSingle);

  function FloatingPointSingle() {
    var _this9;

    _classCallCheck(this, FloatingPointSingle);

    _this9 = _super11.call(this, "FL");
    _this9.maxLength = 4;
    _this9.padByte = 0;
    _this9.fixed = true;
    _this9.defaultValue = 0.0;
    return _this9;
  }

  _createClass(FloatingPointSingle, [{
    key: "readBytes",
    value: function readBytes(stream) {
      return Number(stream.readFloat());
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, writeOptions) {
      return _get(_getPrototypeOf(FloatingPointSingle.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(FloatingPointSingle.prototype), "write", this).call(this, stream, "Float", value), writeOptions);
    }
  }]);

  return FloatingPointSingle;
}(ValueRepresentation);

var FloatingPointDouble = /*#__PURE__*/function (_ValueRepresentation6) {
  _inherits(FloatingPointDouble, _ValueRepresentation6);

  var _super12 = _createSuper(FloatingPointDouble);

  function FloatingPointDouble() {
    var _this10;

    _classCallCheck(this, FloatingPointDouble);

    _this10 = _super12.call(this, "FD");
    _this10.maxLength = 8;
    _this10.padByte = 0;
    _this10.fixed = true;
    _this10.defaultValue = 0.0;
    return _this10;
  }

  _createClass(FloatingPointDouble, [{
    key: "readBytes",
    value: function readBytes(stream) {
      return Number(stream.readDouble());
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, writeOptions) {
      return _get(_getPrototypeOf(FloatingPointDouble.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(FloatingPointDouble.prototype), "write", this).call(this, stream, "Double", value), writeOptions);
    }
  }]);

  return FloatingPointDouble;
}(ValueRepresentation);

var IntegerString = /*#__PURE__*/function (_AsciiStringRepresent7) {
  _inherits(IntegerString, _AsciiStringRepresent7);

  var _super13 = _createSuper(IntegerString);

  function IntegerString() {
    var _this11;

    _classCallCheck(this, IntegerString);

    _this11 = _super13.call(this, "IS");
    _this11.maxLength = 12;
    _this11.padByte = 0x20;
    return _this11;
  }

  _createClass(IntegerString, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      var BACKSLASH = String.fromCharCode(0x5c);
      var is = stream.readAsciiString(length).trim();
      is = is.replace(/[^0-9.\\\-+e]/gi, "");

      if (is.indexOf(BACKSLASH) !== -1) {
        // handle integer string with multiplicity
        var integerStringArray = is.split(BACKSLASH);
        is = integerStringArray.map(function (is) {
          return is === "" ? null : Number(is);
        });
      } else {
        is = [is === "" ? null : Number(is)];
      }

      return is;
    }
  }, {
    key: "formatValue",
    value: function formatValue(value) {
      return value === null ? "" : String(value);
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, writeOptions) {
      var _this12 = this;

      var val = Array.isArray(value) ? value.map(function (is) {
        return _this12.formatValue(is);
      }) : [this.formatValue(value)];
      return _get(_getPrototypeOf(IntegerString.prototype), "writeBytes", this).call(this, stream, val, writeOptions);
    }
  }]);

  return IntegerString;
}(AsciiStringRepresentation);

var LongString = /*#__PURE__*/function (_EncodedStringReprese) {
  _inherits(LongString, _EncodedStringReprese);

  var _super14 = _createSuper(LongString);

  function LongString() {
    var _this13;

    _classCallCheck(this, LongString);

    _this13 = _super14.call(this, "LO");
    _this13.maxCharLength = 64;
    _this13.padByte = 0x20;
    return _this13;
  }

  _createClass(LongString, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      return stream.readEncodedString(length).trim();
    }
  }]);

  return LongString;
}(EncodedStringRepresentation);

var LongText = /*#__PURE__*/function (_EncodedStringReprese2) {
  _inherits(LongText, _EncodedStringReprese2);

  var _super15 = _createSuper(LongText);

  function LongText() {
    var _this14;

    _classCallCheck(this, LongText);

    _this14 = _super15.call(this, "LT");
    _this14.maxCharLength = 10240;
    _this14.padByte = 0x20;
    return _this14;
  }

  _createClass(LongText, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      return rtrim(stream.readEncodedString(length));
    }
  }]);

  return LongText;
}(EncodedStringRepresentation);

var PersonName = /*#__PURE__*/function (_EncodedStringReprese3) {
  _inherits(PersonName, _EncodedStringReprese3);

  var _super16 = _createSuper(PersonName);

  function PersonName() {
    var _this15;

    _classCallCheck(this, PersonName);

    _this15 = _super16.call(this, "PN");
    _this15.maxLength = null;
    _this15.padByte = 0x20;
    return _this15;
  }

  _createClass(PersonName, [{
    key: "checkLength",
    value: function checkLength(value) {
      var components = [];

      if (_typeof(value) === "object" && value !== null) {
        // In DICOM JSON, components are encoded as a mapping (object),
        // where the keys are one or more of the following: "Alphabetic",
        // "Ideographic", "Phonetic".
        // http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_F.2.2.html
        components = Object.keys(value).forEach(function (key) {
          return value[key];
        });
      } else if (typeof value === "string" || value instanceof String) {
        // In DICOM Part10, components are encoded as a string,
        // where components ("Alphabetic", "Ideographic", "Phonetic")
        // are separated by the "=" delimeter.
        // http://dicom.nema.org/medical/dicom/current/output/chtml/part05/sect_6.2.html
        components = value.split(/\=/);
      }

      for (var i in components) {
        var cmp = components[i];
        if (cmp.length > 64) return false;
      }

      return true;
    }
  }, {
    key: "readBytes",
    value: function readBytes(stream, length) {
      return rtrim(stream.readEncodedString(length));
    }
  }]);

  return PersonName;
}(EncodedStringRepresentation);

var ShortString = /*#__PURE__*/function (_EncodedStringReprese4) {
  _inherits(ShortString, _EncodedStringReprese4);

  var _super17 = _createSuper(ShortString);

  function ShortString() {
    var _this16;

    _classCallCheck(this, ShortString);

    _this16 = _super17.call(this, "SH");
    _this16.maxCharLength = 16;
    _this16.padByte = 0x20;
    return _this16;
  }

  _createClass(ShortString, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      return stream.readEncodedString(length).trim();
    }
  }]);

  return ShortString;
}(EncodedStringRepresentation);

var SignedLong = /*#__PURE__*/function (_ValueRepresentation7) {
  _inherits(SignedLong, _ValueRepresentation7);

  var _super18 = _createSuper(SignedLong);

  function SignedLong() {
    var _this17;

    _classCallCheck(this, SignedLong);

    _this17 = _super18.call(this, "SL");
    _this17.maxLength = 4;
    _this17.padByte = 0;
    _this17.fixed = true;
    _this17.defaultValue = 0;
    return _this17;
  }

  _createClass(SignedLong, [{
    key: "readBytes",
    value: function readBytes(stream) {
      return stream.readInt32();
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, writeOptions) {
      return _get(_getPrototypeOf(SignedLong.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(SignedLong.prototype), "write", this).call(this, stream, "Int32", value), writeOptions);
    }
  }]);

  return SignedLong;
}(ValueRepresentation);

var SequenceOfItems = /*#__PURE__*/function (_ValueRepresentation8) {
  _inherits(SequenceOfItems, _ValueRepresentation8);

  var _super19 = _createSuper(SequenceOfItems);

  function SequenceOfItems() {
    var _this18;

    _classCallCheck(this, SequenceOfItems);

    _this18 = _super19.call(this, "SQ");
    _this18.maxLength = null;
    _this18.padByte = 0;
    _this18.noMultiple = true;
    return _this18;
  }

  _createClass(SequenceOfItems, [{
    key: "readBytes",
    value: function readBytes(stream, sqlength, syntax) {
      if (sqlength == 0x0) {
        return []; //contains no dataset
      } else {
        var undefLength = sqlength == 0xffffffff,
            elements = [],
            read = 0;
        /* eslint-disable-next-line no-constant-condition */

        while (true) {
          var tag = Tag.readTag(stream),
              length = null;
          read += 4;

          if (tag.is(0xfffee0dd)) {
            stream.readUint32();
            break;
          } else if (!undefLength && read == sqlength) {
            break;
          } else if (tag.is(0xfffee000)) {
            length = stream.readUint32();
            read += 4;
            var itemStream = null,
                toRead = 0,
                undef = length == 0xffffffff;

            if (undef) {
              var stack = 0;
              /* eslint-disable-next-line no-constant-condition */

              while (1) {
                var g = stream.readUint16();

                if (g == 0xfffe) {
                  // some control tag is about to be read
                  var ge = stream.readUint16();
                  var itemLength = stream.readUint32();
                  stream.increment(-4);

                  if (ge == 0xe00d) {
                    if (itemLength === 0) {
                      // item delimitation tag (0xfffee00d) + item length (0x00000000) has been read
                      stack--;

                      if (stack < 0) {
                        // if we are outside every stack, then we are finished reading the sequence of items
                        stream.increment(4);
                        read += 8;
                        break;
                      } else {
                        // otherwise, we were in a nested sequence of items
                        toRead += 4;
                      }
                    } else {
                      // anything else has been read
                      toRead += 2;
                    }
                  } else if (ge == 0xe000) {
                    // a new item has been found
                    toRead += 4;

                    if (itemLength == 0xffffffff) {
                      // a new item with undefined length has been found
                      stack++;
                    }
                  } else {
                    // some control tag that does not concern sequence of items has been read
                    toRead += 2;
                    stream.increment(-2);
                  }
                } else {
                  // anything else has been read
                  toRead += 2;
                }
              }
            } else {
              toRead = length;
            }

            if (toRead) {
              stream.increment(undef ? -toRead - 8 : 0);
              itemStream = stream.more(toRead); //parseElements

              read += toRead;
              if (undef) stream.increment(8);

              var items = DicomMessage._read(itemStream, syntax);

              elements.push(items);
            }

            if (!undefLength && read == sqlength) {
              break;
            }
          }
        }

        return elements;
      }
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, syntax, writeOptions) {
      var written = 0;

      if (value) {
        for (var i = 0; i < value.length; i++) {
          var item = value[i];

          _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint16", 0xfffe);

          _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint16", 0xe000);

          _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint32", 0xffffffff);

          written += DicomMessage.write(item, stream, syntax, writeOptions);

          _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint16", 0xfffe);

          _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint16", 0xe00d);

          _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint32", 0x00000000);

          written += 16;
        }
      }

      _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint16", 0xfffe);

      _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint16", 0xe0dd);

      _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint32", 0x00000000);

      written += 8;
      return _get(_getPrototypeOf(SequenceOfItems.prototype), "writeBytes", this).call(this, stream, value, [written], writeOptions);
    }
  }]);

  return SequenceOfItems;
}(ValueRepresentation);

var SignedShort = /*#__PURE__*/function (_ValueRepresentation9) {
  _inherits(SignedShort, _ValueRepresentation9);

  var _super20 = _createSuper(SignedShort);

  function SignedShort() {
    var _this19;

    _classCallCheck(this, SignedShort);

    _this19 = _super20.call(this, "SS");
    _this19.maxLength = 2;
    _this19.valueLength = 2;
    _this19.padByte = 0;
    _this19.fixed = true;
    _this19.defaultValue = 0;
    return _this19;
  }

  _createClass(SignedShort, [{
    key: "readBytes",
    value: function readBytes(stream) {
      return stream.readInt16();
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, writeOptions) {
      return _get(_getPrototypeOf(SignedShort.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(SignedShort.prototype), "write", this).call(this, stream, "Int16", value), writeOptions);
    }
  }]);

  return SignedShort;
}(ValueRepresentation);

var ShortText = /*#__PURE__*/function (_EncodedStringReprese5) {
  _inherits(ShortText, _EncodedStringReprese5);

  var _super21 = _createSuper(ShortText);

  function ShortText() {
    var _this20;

    _classCallCheck(this, ShortText);

    _this20 = _super21.call(this, "ST");
    _this20.maxCharLength = 1024;
    _this20.padByte = 0x20;
    return _this20;
  }

  _createClass(ShortText, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      return rtrim(stream.readEncodedString(length));
    }
  }]);

  return ShortText;
}(EncodedStringRepresentation);

var TimeValue = /*#__PURE__*/function (_AsciiStringRepresent8) {
  _inherits(TimeValue, _AsciiStringRepresent8);

  var _super22 = _createSuper(TimeValue);

  function TimeValue() {
    var _this21;

    _classCallCheck(this, TimeValue);

    _this21 = _super22.call(this, "TM");
    _this21.maxLength = 14;
    _this21.padByte = 0x20;
    return _this21;
  }

  _createClass(TimeValue, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      return rtrim(stream.readAsciiString(length));
    }
  }]);

  return TimeValue;
}(AsciiStringRepresentation);

var UnlimitedCharacters = /*#__PURE__*/function (_EncodedStringReprese6) {
  _inherits(UnlimitedCharacters, _EncodedStringReprese6);

  var _super23 = _createSuper(UnlimitedCharacters);

  function UnlimitedCharacters() {
    var _this22;

    _classCallCheck(this, UnlimitedCharacters);

    _this22 = _super23.call(this, "UC");
    _this22.maxLength = null;
    _this22.multi = true;
    _this22.padByte = 0x20;
    return _this22;
  }

  _createClass(UnlimitedCharacters, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      return rtrim(stream.readEncodedString(length));
    }
  }]);

  return UnlimitedCharacters;
}(EncodedStringRepresentation);

var UnlimitedText = /*#__PURE__*/function (_EncodedStringReprese7) {
  _inherits(UnlimitedText, _EncodedStringReprese7);

  var _super24 = _createSuper(UnlimitedText);

  function UnlimitedText() {
    var _this23;

    _classCallCheck(this, UnlimitedText);

    _this23 = _super24.call(this, "UT");
    _this23.maxLength = null;
    _this23.padByte = 0x20;
    return _this23;
  }

  _createClass(UnlimitedText, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      return rtrim(stream.readEncodedString(length));
    }
  }]);

  return UnlimitedText;
}(EncodedStringRepresentation);

var UnsignedShort = /*#__PURE__*/function (_ValueRepresentation10) {
  _inherits(UnsignedShort, _ValueRepresentation10);

  var _super25 = _createSuper(UnsignedShort);

  function UnsignedShort() {
    var _this24;

    _classCallCheck(this, UnsignedShort);

    _this24 = _super25.call(this, "US");
    _this24.maxLength = 2;
    _this24.padByte = 0;
    _this24.fixed = true;
    _this24.defaultValue = 0;
    return _this24;
  }

  _createClass(UnsignedShort, [{
    key: "readBytes",
    value: function readBytes(stream) {
      return stream.readUint16();
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, writeOptions) {
      return _get(_getPrototypeOf(UnsignedShort.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(UnsignedShort.prototype), "write", this).call(this, stream, "Uint16", value), writeOptions);
    }
  }]);

  return UnsignedShort;
}(ValueRepresentation);

var UnsignedLong = /*#__PURE__*/function (_ValueRepresentation11) {
  _inherits(UnsignedLong, _ValueRepresentation11);

  var _super26 = _createSuper(UnsignedLong);

  function UnsignedLong() {
    var _this25;

    _classCallCheck(this, UnsignedLong);

    _this25 = _super26.call(this, "UL");
    _this25.maxLength = 4;
    _this25.padByte = 0;
    _this25.fixed = true;
    _this25.defaultValue = 0;
    return _this25;
  }

  _createClass(UnsignedLong, [{
    key: "readBytes",
    value: function readBytes(stream) {
      return stream.readUint32();
    }
  }, {
    key: "writeBytes",
    value: function writeBytes(stream, value, writeOptions) {
      return _get(_getPrototypeOf(UnsignedLong.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(UnsignedLong.prototype), "write", this).call(this, stream, "Uint32", value), writeOptions);
    }
  }]);

  return UnsignedLong;
}(ValueRepresentation);

var UniqueIdentifier = /*#__PURE__*/function (_AsciiStringRepresent9) {
  _inherits(UniqueIdentifier, _AsciiStringRepresent9);

  var _super27 = _createSuper(UniqueIdentifier);

  function UniqueIdentifier() {
    var _this26;

    _classCallCheck(this, UniqueIdentifier);

    _this26 = _super27.call(this, "UI");
    _this26.maxLength = 64;
    _this26.padByte = 0;
    return _this26;
  }

  _createClass(UniqueIdentifier, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      var result = this.readNullPaddedString(stream, length);
      var BACKSLASH = String.fromCharCode(0x5c);
      var uidRegExp = /[^0-9.]/g; // Treat backslashes as a delimiter for multiple UIDs, in which case an
      // array of UIDs is returned. This is used by DICOM Q&R to support
      // querying and matching multiple items on a UID field in a single
      // query. For more details see:
      //
      // https://dicom.nema.org/medical/dicom/current/output/chtml/part04/sect_C.2.2.2.2.html
      // https://dicom.nema.org/medical/dicom/current/output/chtml/part05/sect_6.4.html

      if (result.indexOf(BACKSLASH) === -1) {
        return result.replace(uidRegExp, "");
      } else {
        return result.split(BACKSLASH).map(function (uid) {
          return uid.replace(uidRegExp, "");
        });
      }
    }
  }]);

  return UniqueIdentifier;
}(AsciiStringRepresentation);

var UniversalResource = /*#__PURE__*/function (_AsciiStringRepresent10) {
  _inherits(UniversalResource, _AsciiStringRepresent10);

  var _super28 = _createSuper(UniversalResource);

  function UniversalResource() {
    var _this27;

    _classCallCheck(this, UniversalResource);

    _this27 = _super28.call(this, "UR");
    _this27.maxLength = null;
    _this27.padByte = 0x20;
    return _this27;
  }

  _createClass(UniversalResource, [{
    key: "readBytes",
    value: function readBytes(stream, length) {
      return stream.readAsciiString(length);
    }
  }]);

  return UniversalResource;
}(AsciiStringRepresentation);

var UnknownValue = /*#__PURE__*/function (_BinaryRepresentation) {
  _inherits(UnknownValue, _BinaryRepresentation);

  var _super29 = _createSuper(UnknownValue);

  function UnknownValue() {
    var _this28;

    _classCallCheck(this, UnknownValue);

    _this28 = _super29.call(this, "UN");
    _this28.maxLength = null;
    _this28.padByte = 0;
    _this28.noMultiple = true;
    return _this28;
  }

  return _createClass(UnknownValue);
}(BinaryRepresentation);

var OtherWordString = /*#__PURE__*/function (_BinaryRepresentation2) {
  _inherits(OtherWordString, _BinaryRepresentation2);

  var _super30 = _createSuper(OtherWordString);

  function OtherWordString() {
    var _this29;

    _classCallCheck(this, OtherWordString);

    _this29 = _super30.call(this, "OW");
    _this29.maxLength = null;
    _this29.padByte = 0;
    _this29.noMultiple = true;
    return _this29;
  }

  return _createClass(OtherWordString);
}(BinaryRepresentation);

var OtherByteString = /*#__PURE__*/function (_BinaryRepresentation3) {
  _inherits(OtherByteString, _BinaryRepresentation3);

  var _super31 = _createSuper(OtherByteString);

  function OtherByteString() {
    var _this30;

    _classCallCheck(this, OtherByteString);

    _this30 = _super31.call(this, "OB");
    _this30.maxLength = null;
    _this30.padByte = 0;
    _this30.noMultiple = true;
    return _this30;
  }

  return _createClass(OtherByteString);
}(BinaryRepresentation);

var OtherDoubleString = /*#__PURE__*/function (_BinaryRepresentation4) {
  _inherits(OtherDoubleString, _BinaryRepresentation4);

  var _super32 = _createSuper(OtherDoubleString);

  function OtherDoubleString() {
    var _this31;

    _classCallCheck(this, OtherDoubleString);

    _this31 = _super32.call(this, "OD");
    _this31.maxLength = null;
    _this31.padByte = 0;
    _this31.noMultiple = true;
    return _this31;
  }

  return _createClass(OtherDoubleString);
}(BinaryRepresentation);

var OtherFloatString = /*#__PURE__*/function (_BinaryRepresentation5) {
  _inherits(OtherFloatString, _BinaryRepresentation5);

  var _super33 = _createSuper(OtherFloatString);

  function OtherFloatString() {
    var _this32;

    _classCallCheck(this, OtherFloatString);

    _this32 = _super33.call(this, "OF");
    _this32.maxLength = null;
    _this32.padByte = 0;
    _this32.noMultiple = true;
    return _this32;
  }

  return _createClass(OtherFloatString);
}(BinaryRepresentation); // these VR instances are precreate and are reused for each requested vr/tag


var VRinstances = {
  AE: new ApplicationEntity(),
  AS: new AgeString(),
  AT: new AttributeTag(),
  CS: new CodeString(),
  DA: new DateValue(),
  DS: new DecimalString(),
  DT: new DateTime(),
  FL: new FloatingPointSingle(),
  FD: new FloatingPointDouble(),
  IS: new IntegerString(),
  LO: new LongString(),
  LT: new LongText(),
  OB: new OtherByteString(),
  OD: new OtherDoubleString(),
  OF: new OtherFloatString(),
  OW: new OtherWordString(),
  PN: new PersonName(),
  SH: new ShortString(),
  SL: new SignedLong(),
  SQ: new SequenceOfItems(),
  SS: new SignedShort(),
  ST: new ShortText(),
  TM: new TimeValue(),
  UC: new UnlimitedCharacters(),
  UI: new UniqueIdentifier(),
  UL: new UnsignedLong(),
  UN: new UnknownValue(),
  UR: new UniversalResource(),
  US: new UnsignedShort(),
  UT: new UnlimitedText()
};

var DicomMetaDictionary = /*#__PURE__*/function () {
  // intakes a custom dictionary that will be used to parse/denaturalize the dataset
  function DicomMetaDictionary(customDictionary) {
    _classCallCheck(this, DicomMetaDictionary);

    this.customDictionary = customDictionary;
    this.customNameMap = DicomMetaDictionary._generateCustomNameMap(customDictionary);
  }

  _createClass(DicomMetaDictionary, [{
    key: "denaturalizeDataset",
    value: // denaturalizes dataset using custom dictionary and nameMap
    function denaturalizeDataset(dataset) {
      return DicomMetaDictionary.denaturalizeDataset(dataset, this.customNameMap);
    }
  }], [{
    key: "punctuateTag",
    value: function punctuateTag(rawTag) {
      if (rawTag.indexOf(",") !== -1) {
        return rawTag;
      }

      if (rawTag.length === 8 && rawTag === rawTag.match(/[0-9a-fA-F]*/)[0]) {
        var tag = rawTag.toUpperCase();
        return "(" + tag.substring(0, 4) + "," + tag.substring(4, 8) + ")";
      }
    }
  }, {
    key: "unpunctuateTag",
    value: function unpunctuateTag(tag) {
      if (tag.indexOf(",") === -1) {
        return tag;
      }

      return tag.substring(1, 10).replace(",", "");
    }
  }, {
    key: "parseIntFromTag",
    value: function parseIntFromTag(tag) {
      var integerValue = parseInt("0x" + DicomMetaDictionary.unpunctuateTag(tag));
      return integerValue;
    }
  }, {
    key: "tagAsIntegerFromName",
    value: function tagAsIntegerFromName(name) {
      var item = DicomMetaDictionary.nameMap[name];

      if (item != undefined) {
        return this.parseIntFromTag(item.tag);
      } else {
        return undefined;
      }
    } // fixes some common errors in VRs
    // TODO: if this gets longer it could go in ValueRepresentation.js
    // or in a dedicated class

  }, {
    key: "cleanDataset",
    value: function cleanDataset(dataset) {
      var cleanedDataset = {};
      Object.keys(dataset).forEach(function (tag) {
        var data = Object.assign({}, dataset[tag]);

        if (data.vr == "SQ") {
          var cleanedValues = [];
          Object.keys(data.Value).forEach(function (index) {
            cleanedValues.push(DicomMetaDictionary.cleanDataset(data.Value[index]));
          });
          data.Value = cleanedValues;
        } else {
          // remove null characters from strings
          data.Value = Object.keys(data.Value).map(function (index) {
            var item = data.Value[index];

            if (item.constructor.name == "String") {
              return item.replace(/\0/, "");
            }

            return item;
          });
        }

        cleanedDataset[tag] = data;
      });
      return cleanedDataset;
    } // unlike naturalizeDataset, this only
    // changes the names of the member variables
    // but leaves the values intact

  }, {
    key: "namifyDataset",
    value: function namifyDataset(dataset) {
      var namedDataset = {};
      Object.keys(dataset).forEach(function (tag) {
        var data = Object.assign({}, dataset[tag]);

        if (data.vr == "SQ") {
          var namedValues = [];
          Object.keys(data.Value).forEach(function (index) {
            namedValues.push(DicomMetaDictionary.namifyDataset(data.Value[index]));
          });
          data.Value = namedValues;
        }

        var punctuatedTag = DicomMetaDictionary.punctuateTag(tag);
        var entry = DicomMetaDictionary.dictionary[punctuatedTag];
        var name = tag;

        if (entry) {
          name = entry.name;
        }

        namedDataset[name] = data;
      });
      return namedDataset;
    }
    /** converts from DICOM JSON Model dataset to a natural dataset
     * - sequences become lists
     * - single element lists are replaced by their first element,
     *     with single element lists remaining lists, but being a
     *     proxy for the child values, see addAccessors for examples
     * - object member names are dictionary, not group/element tag
     */

  }, {
    key: "naturalizeDataset",
    value: function naturalizeDataset(dataset) {
      var naturalDataset = {
        _vrMap: {}
      };
      Object.keys(dataset).forEach(function (tag) {
        var data = dataset[tag];
        var punctuatedTag = DicomMetaDictionary.punctuateTag(tag);
        var entry = DicomMetaDictionary.dictionary[punctuatedTag];
        var naturalName = tag;

        if (entry) {
          naturalName = entry.name;

          if (entry.vr == "ox") {
            // when the vr is data-dependent, keep track of the original type
            naturalDataset._vrMap[naturalName] = data.vr;
          }
        }

        if (data.Value === undefined) {
          // In the case of type 2, add this tag but explictly set it null to indicate its empty.
          naturalDataset[naturalName] = null;

          if (data.InlineBinary) {
            naturalDataset[naturalName] = {
              InlineBinary: data.InlineBinary
            };
          } else if (data.BulkDataURI) {
            naturalDataset[naturalName] = {
              BulkDataURI: data.BulkDataURI
            };
          }
        } else {
          if (data.vr === "SQ") {
            // convert sequence to list of values
            var naturalValues = [];
            Object.keys(data.Value).forEach(function (index) {
              naturalValues.push(DicomMetaDictionary.naturalizeDataset(data.Value[index]));
            });
            naturalDataset[naturalName] = naturalValues;
          } else {
            naturalDataset[naturalName] = data.Value;
          }

          if (naturalDataset[naturalName].length === 1) {
            var sqZero = naturalDataset[naturalName][0];

            if (sqZero && _typeof(sqZero) === "object" && !sqZero.length) {
              naturalDataset[naturalName] = addAccessors(naturalDataset[naturalName], sqZero);
            } else {
              naturalDataset[naturalName] = sqZero;
            }
          }
        }
      });
      return naturalDataset;
    }
  }, {
    key: "denaturalizeValue",
    value: function denaturalizeValue(naturalValue) {
      var value = naturalValue;

      if (!Array.isArray(value)) {
        value = [value];
      } else {
        var thereIsUndefinedValues = naturalValue.some(function (item) {
          return item === undefined;
        });

        if (thereIsUndefinedValues) {
          throw new Error("There are undefined values at the array naturalValue in DicomMetaDictionary.denaturalizeValue");
        }
      }

      value = value.map(function (entry) {
        return entry.constructor.name == "Number" ? String(entry) : entry;
      });
      return value;
    } // keep the static function to support previous calls to the class

  }, {
    key: "denaturalizeDataset",
    value: function denaturalizeDataset(dataset) {
      var nameMap = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DicomMetaDictionary.nameMap;
      var unnaturalDataset = {};
      Object.keys(dataset).forEach(function (naturalName) {
        // check if it's a sequence
        var name = naturalName;
        var entry = nameMap[name];

        if (entry) {
          var dataValue = dataset[naturalName];

          if (dataValue === undefined) {
            // handle the case where it was deleted from the object but is in keys
            return;
          } // process this one entry


          var dataItem = {
            vr: entry.vr,
            Value: dataset[naturalName]
          };

          if (dataValue !== null) {
            if (entry.vr == "ox") {
              if (dataset._vrMap && dataset._vrMap[naturalName]) {
                dataItem.vr = dataset._vrMap[naturalName];
              } else {
                log.error("No value representation given for", naturalName);
              }
            }

            dataItem.Value = DicomMetaDictionary.denaturalizeValue(dataItem.Value);

            if (entry.vr == "SQ") {
              var unnaturalValues = [];

              for (var datasetIndex = 0; datasetIndex < dataItem.Value.length; datasetIndex++) {
                var nestedDataset = dataItem.Value[datasetIndex];
                unnaturalValues.push(DicomMetaDictionary.denaturalizeDataset(nestedDataset, nameMap));
              }

              dataItem.Value = unnaturalValues;
            }

            var vr = ValueRepresentation.createByTypeString(dataItem.vr);

            if (!vr.isBinary() && vr.maxLength) {
              dataItem.Value = dataItem.Value.map(function (value) {
                if (value.length > vr.maxLength) {
                  log.warn("Truncating value ".concat(value, " of ").concat(naturalName, " because it is longer than ").concat(vr.maxLength));
                  return value.slice(0, vr.maxLength);
                } else {
                  return value;
                }
              });
            }
          }

          var tag = DicomMetaDictionary.unpunctuateTag(entry.tag);
          unnaturalDataset[tag] = dataItem;
        } else {
          var validMetaNames = ["_vrMap", "_meta"];

          if (validMetaNames.indexOf(name) == -1) {
            log.warn("Unknown name in dataset", name, ":", dataset[name]);
          }
        }
      });
      return unnaturalDataset;
    }
  }, {
    key: "uid",
    value: function uid() {
      var uid = "2.25." + Math.floor(1 + Math.random() * 9);

      for (var index = 0; index < 38; index++) {
        uid = uid + Math.floor(Math.random() * 10);
      }

      return uid;
    } // date and time in UTC

  }, {
    key: "date",
    value: function date() {
      var now = new Date();
      return now.toISOString().replace(/-/g, "").slice(0, 8);
    }
  }, {
    key: "time",
    value: function time() {
      var now = new Date();
      return now.toISOString().replace(/:/g, "").slice(11, 17);
    }
  }, {
    key: "dateTime",
    value: function dateTime() {
      // "2017-07-07T16:09:18.079Z" -> "20170707160918.079"
      var now = new Date();
      return now.toISOString().replace(/[:\-TZ]/g, "");
    }
  }, {
    key: "_generateNameMap",
    value: function _generateNameMap() {
      DicomMetaDictionary.nameMap = {};
      Object.keys(DicomMetaDictionary.dictionary).forEach(function (tag) {
        var dict = DicomMetaDictionary.dictionary[tag];

        if (dict.version != "PrivateTag") {
          DicomMetaDictionary.nameMap[dict.name] = dict;
        }
      });
    }
  }, {
    key: "_generateCustomNameMap",
    value: function _generateCustomNameMap(dictionary) {
      var nameMap = {};
      Object.keys(dictionary).forEach(function (tag) {
        var dict = dictionary[tag];

        if (dict.version != "PrivateTag") {
          nameMap[dict.name] = dict;
        }
      });
      return nameMap;
    }
  }, {
    key: "_generateUIDMap",
    value: function _generateUIDMap() {
      DicomMetaDictionary.sopClassUIDsByName = {};
      Object.keys(DicomMetaDictionary.sopClassNamesByUID).forEach(function (uid) {
        var name = DicomMetaDictionary.sopClassNamesByUID[uid];
        DicomMetaDictionary.sopClassUIDsByName[name] = uid;
      });
    }
  }]);

  return DicomMetaDictionary;
}(); // Subset of those listed at:
// http://dicom.nema.org/medical/dicom/current/output/html/part04.html#sect_B.5


DicomMetaDictionary.sopClassNamesByUID = {
  "1.2.840.10008.5.1.4.1.1.2": "CTImage",
  "1.2.840.10008.5.1.4.1.1.2.1": "EnhancedCTImage",
  "1.2.840.10008.5.1.4.1.1.2.2": "LegacyConvertedEnhancedCTImage",
  "1.2.840.10008.5.1.4.1.1.3.1": "USMultiframeImage",
  "1.2.840.10008.5.1.4.1.1.4": "MRImage",
  "1.2.840.10008.5.1.4.1.1.4.1": "EnhancedMRImage",
  "1.2.840.10008.5.1.4.1.1.4.2": "MRSpectroscopy",
  "1.2.840.10008.5.1.4.1.1.4.3": "EnhancedMRColorImage",
  "1.2.840.10008.5.1.4.1.1.4.4": "LegacyConvertedEnhancedMRImage",
  "1.2.840.10008.5.1.4.1.1.6.1": "USImage",
  "1.2.840.10008.5.1.4.1.1.6.2": "EnhancedUSVolume",
  "1.2.840.10008.5.1.4.1.1.7": "SecondaryCaptureImage",
  "1.2.840.10008.5.1.4.1.1.30": "ParametricMapStorage",
  "1.2.840.10008.5.1.4.1.1.66": "RawData",
  "1.2.840.10008.5.1.4.1.1.66.1": "SpatialRegistration",
  "1.2.840.10008.5.1.4.1.1.66.2": "SpatialFiducials",
  "1.2.840.10008.5.1.4.1.1.66.3": "DeformableSpatialRegistration",
  "1.2.840.10008.5.1.4.1.1.66.4": "Segmentation",
  "1.2.840.10008.5.1.4.1.1.67": "RealWorldValueMapping",
  "1.2.840.10008.5.1.4.1.1.88.11": "BasicTextSR",
  "1.2.840.10008.5.1.4.1.1.88.22": "EnhancedSR",
  "1.2.840.10008.5.1.4.1.1.88.33": "ComprehensiveSR",
  "1.2.840.10008.5.1.4.1.1.128": "PETImage",
  "1.2.840.10008.5.1.4.1.1.130": "EnhancedPETImage",
  "1.2.840.10008.5.1.4.1.1.128.1": "LegacyConvertedEnhancedPETImage"
};
DicomMetaDictionary.dictionary = dictionary;

DicomMetaDictionary._generateNameMap();

DicomMetaDictionary._generateUIDMap();

var singleVRs = ["SQ", "OF", "OW", "OB", "UN", "LT"];
var encodingMapping = {
  "": "iso-8859-1",
  "iso-ir-6": "iso-8859-1",
  "iso-ir-13": "shift-jis",
  "iso-ir-100": "latin1",
  "iso-ir-101": "iso-8859-2",
  "iso-ir-109": "iso-8859-3",
  "iso-ir-110": "iso-8859-4",
  "iso-ir-126": "iso-ir-126",
  "iso-ir-127": "iso-ir-127",
  "iso-ir-138": "iso-ir-138",
  "iso-ir-144": "iso-ir-144",
  "iso-ir-148": "iso-ir-148",
  "iso-ir-166": "tis-620",
  "iso-2022-ir-6": "iso-8859-1",
  "iso-2022-ir-13": "shift-jis",
  "iso-2022-ir-87": "iso-2022-jp",
  "iso-2022-ir-100": "latin1",
  "iso-2022-ir-101": "iso-8859-2",
  "iso-2022-ir-109": "iso-8859-3",
  "iso-2022-ir-110": "iso-8859-4",
  "iso-2022-ir-126": "iso-ir-126",
  "iso-2022-ir-127": "iso-ir-127",
  "iso-2022-ir-138": "iso-ir-138",
  "iso-2022-ir-144": "iso-ir-144",
  "iso-2022-ir-148": "iso-ir-148",
  "iso-2022-ir-149": "euc-kr",
  "iso-2022-ir-159": "iso-2022-jp",
  "iso-2022-ir-166": "tis-620",
  "iso-2022-ir-58": "iso-ir-58",
  "iso-ir-192": "utf-8",
  gb18030: "gb18030",
  "iso-2022-gbk": "gbk",
  "iso-2022-58": "gb2312",
  gbk: "gbk"
};
var encapsulatedSyntaxes = ["1.2.840.10008.1.2.4.50", "1.2.840.10008.1.2.4.51", "1.2.840.10008.1.2.4.57", "1.2.840.10008.1.2.4.70", "1.2.840.10008.1.2.4.80", "1.2.840.10008.1.2.4.81", "1.2.840.10008.1.2.4.90", "1.2.840.10008.1.2.4.91", "1.2.840.10008.1.2.4.92", "1.2.840.10008.1.2.4.93", "1.2.840.10008.1.2.4.94", "1.2.840.10008.1.2.4.95", "1.2.840.10008.1.2.5", "1.2.840.10008.1.2.6.1", "1.2.840.10008.1.2.4.100", "1.2.840.10008.1.2.4.102", "1.2.840.10008.1.2.4.103"];

var DicomMessage = /*#__PURE__*/function () {
  function DicomMessage() {
    _classCallCheck(this, DicomMessage);
  }

  _createClass(DicomMessage, null, [{
    key: "read",
    value: function read(bufferStream, syntax, ignoreErrors) {
      var untilTag = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
      var includeUntilTagValue = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
      log.warn("DicomMessage.read to be deprecated after dcmjs 0.24.x");
      return this._read(bufferStream, syntax, {
        ignoreErrors: ignoreErrors,
        untilTag: untilTag,
        includeUntilTagValue: includeUntilTagValue
      });
    }
  }, {
    key: "readTag",
    value: function readTag(bufferStream, syntax) {
      var untilTag = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
      var includeUntilTagValue = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
      log.warn("DicomMessage.readTag to be deprecated after dcmjs 0.24.x");
      return this._readTag(bufferStream, syntax, {
        untilTag: untilTag,
        includeUntilTagValue: includeUntilTagValue
      });
    }
  }, {
    key: "_read",
    value: function _read(bufferStream, syntax) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
        ignoreErrors: false,
        untilTag: null,
        includeUntilTagValue: false
      };
      var ignoreErrors = options.ignoreErrors,
          untilTag = options.untilTag;
      var dict = {};

      try {
        while (!bufferStream.end()) {
          var readInfo = DicomMessage._readTag(bufferStream, syntax, options);

          var cleanTagString = readInfo.tag.toCleanString();

          if (cleanTagString === "00080005") {
            if (readInfo.values.length > 0) {
              var coding = readInfo.values[0];
              coding = coding.replace(/[_ ]/g, "-").toLowerCase();

              if (coding in encodingMapping) {
                coding = encodingMapping[coding];
                bufferStream.setDecoder(new TextDecoder(coding));
              } else if (ignoreErrors) {
                log.warn("Unsupported character set: ".concat(coding, ", using default character set"));
              } else {
                throw Error("Unsupported character set: ".concat(coding));
              }
            }

            if (readInfo.values.length > 1) {
              if (ignoreErrors) {
                log.warn("Using multiple character sets is not supported, proceeding with just the first character set", readInfo.values);
              } else {
                throw Error("Using multiple character sets is not supported: ".concat(readInfo.values));
              }
            }

            readInfo.values = ["ISO_IR 192"]; // change SpecificCharacterSet to UTF-8
          }

          dict[cleanTagString] = {
            vr: readInfo.vr.type,
            Value: readInfo.values
          };

          if (untilTag && untilTag === cleanTagString) {
            break;
          }
        }

        return dict;
      } catch (err) {
        if (ignoreErrors) {
          log.warn("WARN:", err);
          return dict;
        }

        throw err;
      }
    }
  }, {
    key: "_normalizeSyntax",
    value: function _normalizeSyntax(syntax) {
      if (syntax == IMPLICIT_LITTLE_ENDIAN || syntax == EXPLICIT_LITTLE_ENDIAN$1 || syntax == EXPLICIT_BIG_ENDIAN) {
        return syntax;
      } else {
        return EXPLICIT_LITTLE_ENDIAN$1;
      }
    }
  }, {
    key: "isEncapsulated",
    value: function isEncapsulated(syntax) {
      return encapsulatedSyntaxes.indexOf(syntax) != -1;
    }
  }, {
    key: "readFile",
    value: function readFile(buffer) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
        ignoreErrors: false,
        untilTag: null,
        includeUntilTagValue: false,
        noCopy: false
      };
      var stream = new ReadBufferStream(buffer, null, {
        noCopy: options.noCopy
      }),
          useSyntax = EXPLICIT_LITTLE_ENDIAN$1;
      stream.reset();
      stream.increment(128);

      if (stream.readAsciiString(4) !== "DICM") {
        throw new Error("Invalid DICOM file, expected header is missing");
      }

      var el = DicomMessage._readTag(stream, useSyntax);

      if (el.tag.toCleanString() !== "00020000") {
        throw new Error("Invalid DICOM file, meta length tag is malformed or not present.");
      }

      var metaLength = el.values[0]; //read header buffer

      var metaStream = stream.more(metaLength);

      var metaHeader = DicomMessage._read(metaStream, useSyntax, options); //get the syntax


      var mainSyntax = metaHeader["00020010"].Value[0]; //in case of deflated dataset, decompress and continue

      if (mainSyntax === DEFLATED_EXPLICIT_LITTLE_ENDIAN) {
        stream = new DeflatedReadBufferStream(stream, {
          noCopy: options.noCopy
        });
      }

      mainSyntax = DicomMessage._normalizeSyntax(mainSyntax);

      var objects = DicomMessage._read(stream, mainSyntax, options);

      var dicomDict = new DicomDict(metaHeader);
      dicomDict.dict = objects;
      return dicomDict;
    }
  }, {
    key: "writeTagObject",
    value: function writeTagObject(stream, tagString, vr, values, syntax, writeOptions) {
      var tag = Tag.fromString(tagString);
      tag.write(stream, vr, values, syntax, writeOptions);
    }
  }, {
    key: "write",
    value: function write(jsonObjects, useStream, syntax, writeOptions) {
      var written = 0;
      var sortedTags = Object.keys(jsonObjects).sort();
      sortedTags.forEach(function (tagString) {
        var tag = Tag.fromString(tagString),
            tagObject = jsonObjects[tagString],
            vrType = tagObject.vr,
            values = tagObject.Value;
        written += tag.write(useStream, vrType, values, syntax, writeOptions);
      });
      return written;
    }
  }, {
    key: "_readTag",
    value: function _readTag(stream, syntax) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
        untilTag: null,
        includeUntilTagValue: false
      };
      var untilTag = options.untilTag,
          includeUntilTagValue = options.includeUntilTagValue;
      var implicit = syntax == IMPLICIT_LITTLE_ENDIAN ? true : false,
          isLittleEndian = syntax == IMPLICIT_LITTLE_ENDIAN || syntax == EXPLICIT_LITTLE_ENDIAN$1 ? true : false;
      var oldEndian = stream.isLittleEndian;
      stream.setEndian(isLittleEndian);
      var tag = Tag.readTag(stream);

      if (untilTag === tag.toCleanString() && untilTag !== null) {
        if (!includeUntilTagValue) {
          return {
            tag: tag,
            vr: 0,
            values: 0
          };
        }
      }

      var length = null,
          vr = null,
          vrType;

      if (implicit) {
        length = stream.readUint32();
        var elementData = DicomMessage.lookupTag(tag);

        if (elementData) {
          vrType = elementData.vr;
        } else {
          //unknown tag
          if (length == 0xffffffff) {
            vrType = "SQ";
          } else if (tag.isPixelDataTag()) {
            vrType = "OW";
          } else if (vrType == "xs") {
            vrType = "US";
          } else if (tag.isPrivateCreator()) {
            vrType = "LO";
          } else {
            vrType = "UN";
          }
        }

        vr = ValueRepresentation.createByTypeString(vrType);
      } else {
        vrType = stream.readVR();
        vr = ValueRepresentation.createByTypeString(vrType);

        if (vr.isExplicit()) {
          stream.increment(2);
          length = stream.readUint32();
        } else {
          length = stream.readUint16();
        }
      }

      var values = [];

      if (vr.isBinary() && length > vr.maxLength && !vr.noMultiple) {
        var times = length / vr.maxLength,
            i = 0;

        while (i++ < times) {
          values.push(vr.read(stream, vr.maxLength, syntax));
        }
      } else {
        var val = vr.read(stream, length, syntax);

        if (!vr.isBinary() && singleVRs.indexOf(vr.type) == -1) {
          values = val;

          if (typeof val === "string") {
            values = val.split(String.fromCharCode(0x5c));
          }
        } else if (vr.type == "SQ") {
          values = val;
        } else if (vr.type == "OW" || vr.type == "OB") {
          values = val;
        } else {
          Array.isArray(val) ? values = val : values.push(val);
        }
      }

      stream.setEndian(oldEndian);
      return {
        tag: tag,
        vr: vr,
        values: values
      };
    }
  }, {
    key: "lookupTag",
    value: function lookupTag(tag) {
      return DicomMetaDictionary.dictionary[tag.toString()];
    }
  }]);

  return DicomMessage;
}();

var EXPLICIT_LITTLE_ENDIAN = "1.2.840.10008.1.2.1";

var DicomDict = /*#__PURE__*/function () {
  function DicomDict(meta) {
    _classCallCheck(this, DicomDict);

    this.meta = meta;
    this.dict = {};
  }

  _createClass(DicomDict, [{
    key: "upsertTag",
    value: function upsertTag(tag, vr, values) {
      if (this.dict[tag]) {
        this.dict[tag].Value = values;
      } else {
        this.dict[tag] = {
          vr: vr,
          Value: values
        };
      }
    }
  }, {
    key: "write",
    value: function write() {
      var writeOptions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
        allowInvalidVRLength: false
      };
      var metaSyntax = EXPLICIT_LITTLE_ENDIAN;
      var fileStream = new WriteBufferStream(4096, true);
      fileStream.writeUint8Repeat(0, 128);
      fileStream.writeAsciiString("DICM");
      var metaStream = new WriteBufferStream(1024);

      if (!this.meta["00020010"]) {
        this.meta["00020010"] = {
          vr: "UI",
          Value: [EXPLICIT_LITTLE_ENDIAN]
        };
      }

      DicomMessage.write(this.meta, metaStream, metaSyntax, writeOptions);
      DicomMessage.writeTagObject(fileStream, "00020000", "UL", metaStream.size, metaSyntax, writeOptions);
      fileStream.concat(metaStream);
      var useSyntax = this.meta["00020010"].Value[0];
      DicomMessage.write(this.dict, fileStream, useSyntax, writeOptions);
      return fileStream.getBuffer();
    }
  }]);

  return DicomDict;
}();

var DICOMWEB = /*#__PURE__*/function () {
  /*
  JavaScript DICOMweb REST API for browser use.
   Design:
  * map rest api to high-level code with modern conventions
  ** ES6: classes, arrow functions, let...
  ** promises
  ** json converted to objects
  examples: see tests() method below.
  */
  function DICOMWEB() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, DICOMWEB);

    this.rootURL = options.rootURL;
    this.progressCallback = options.progressCallback;
  }

  _createClass(DICOMWEB, [{
    key: "request",
    value: function request(endpoint) {
      var parameters = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var payload = arguments.length > 2 ? arguments[2] : undefined;
      var responseType = DICOMWEB.responseType(endpoint);
      var service = DICOMWEB.endpointService(endpoint);
      var url = this.rootURL + "/" + service + endpoint;
      var firstParameter = true;
      Object.keys(parameters).forEach(function (parameter) {
        if (firstParameter) {
          url += "?";
          firstParameter = false;
        } else {
          url += "&";
        }

        url += parameter + "=" + encodeURIComponent(parameters[parameter]);
      });

      function promiseHandler(resolve, reject) {
        var request = new XMLHttpRequest();
        request.open("GET", url);
        request.responseType = responseType;

        request.onload = function () {
          resolve(request.response);
        };

        request.onprogress = this.progressCallback;

        request.onerror = function (error) {
          log.error(request.response);
          reject(error);
        };

        request.send(payload);
      }

      var promise = new Promise(promiseHandler.bind(this));
      return promise;
    }
  }, {
    key: "patients",
    value: function patients() {
      return this.request("patients");
    }
  }, {
    key: "studies",
    value: function studies(patientID) {
      return this.request("studies", {
        PatientID: patientID
      });
    }
  }, {
    key: "series",
    value: function series(studyInstanceUID) {
      return this.request("series", {
        StudyInstanceUID: studyInstanceUID
      });
    }
  }, {
    key: "instances",
    value: function instances(studyInstanceUID, seriesInstanceUID) {
      return this.request("instances", {
        StudyInstanceUID: studyInstanceUID,
        SeriesInstanceUID: seriesInstanceUID
      });
    }
  }, {
    key: "instance",
    value: function instance(studyInstanceUID, seriesInstanceUID, sopInstanceUID) {
      return this.request("wado", {
        requestType: "WADO",
        studyUID: studyInstanceUID,
        seriesUID: seriesInstanceUID,
        objectUID: sopInstanceUID,
        contentType: "application/dicom"
      });
    }
  }, {
    key: "tests",
    value: function tests() {
      var testingServerURL = "http://quantome.org:4242/dcm4chee-arc/aets/DCM4CHEE";
      var testOptions = {
        rootURL: testingServerURL
      };
      new DICOMWEB(testOptions).patients().then(function (responses) {
        responses.forEach(function (patient) {
          log.log(patient);
        });
      });
    }
  }], [{
    key: "responseType",
    value: function responseType(endpoint) {
      var types = {
        wado: "arraybuffer"
      };
      return types[endpoint] ? types[endpoint] : "json";
    } // which URL service to use for each of the high level services

  }, {
    key: "endpointService",
    value: function endpointService(endpoint) {
      var services = {
        wado: ""
      };
      return Object.keys(services).indexOf(endpoint) != -1 ? services[endpoint] : "rs/";
    }
  }, {
    key: "randomEntry",
    value: function randomEntry(array) {
      return array[Math.floor(Math.random() * array.length)];
    }
  }]);

  return DICOMWEB;
}();

//
// Handle DICOM and CIELAB colors
// based on:
// https://github.com/michaelonken/dcmtk/blob/3c68f0e882e22e6d9e2a42f836332c0ca21b3e7f/dcmiod/libsrc/cielabutil.cc
//
// RGB here refers to sRGB 0-1 per component.
// dicomlab is CIELAB values as defined in the dicom standard
// XYZ is CIEXYZ convention
//
// TODO: needs a test suite
// TODO: only dicomlab2RGB tested on real data
//
//
var Colors = /*#__PURE__*/function () {
  function Colors() {
    _classCallCheck(this, Colors);
  }

  _createClass(Colors, null, [{
    key: "d65WhitePointXYZ",
    value: function d65WhitePointXYZ() {
      // white points of D65 light point (CIELAB standard white point)
      return [0.950456, 1.0, 1.088754];
    }
  }, {
    key: "dicomlab2RGB",
    value: function dicomlab2RGB(dicomlab) {
      return Colors.lab2RGB(Colors.dicomlab2LAB(dicomlab));
    }
  }, {
    key: "rgb2DICOMLAB",
    value: function rgb2DICOMLAB(rgb) {
      return Colors.lab2DICOMLAB(Colors.rgb2LAB(rgb));
    }
  }, {
    key: "dicomlab2LAB",
    value: function dicomlab2LAB(dicomlab) {
      return [dicomlab[0] * 100.0 / 65535.0, // results in 0 <= L <= 100
      dicomlab[1] * 255.0 / 65535.0 - 128, // results in -128 <= a <= 127
      dicomlab[2] * 255.0 / 65535.0 - 128 // results in -128 <= b <= 127
      ];
    }
  }, {
    key: "lab2DICOMLAB",
    value: function lab2DICOMLAB(lab) {
      return [lab[0] * 65535.0 / 100.0, // results in 0 <= L <= 65535
      (lab[1] + 128) * 65535.0 / 255.0, // results in 0 <= a <= 65535
      (lab[2] + 128) * 65535.0 / 255.0 // results in 0 <= b <= 65535
      ];
    }
  }, {
    key: "rgb2LAB",
    value: function rgb2LAB(rgb) {
      return Colors.xyz2LAB(Colors.rgb2XYZ(rgb));
    }
  }, {
    key: "gammaCorrection",
    value: function gammaCorrection(n) {
      if (n <= 0.0031306684425005883) {
        return 12.92 * n;
      } else {
        return 1.055 * Math.pow(n, 0.416666666666666667) - 0.055;
      }
    }
  }, {
    key: "invGammaCorrection",
    value: function invGammaCorrection(n) {
      if (n <= 0.0404482362771076) {
        return n / 12.92;
      } else {
        return Math.pow((n + 0.055) / 1.055, 2.4);
      }
    }
  }, {
    key: "rgb2XYZ",
    value: function rgb2XYZ(rgb) {
      var R = Colors.invGammaCorrection(rgb[0]);
      var G = Colors.invGammaCorrection(rgb[1]);
      var B = Colors.invGammaCorrection(rgb[2]);
      return [0.4123955889674142161 * R + 0.3575834307637148171 * G + 0.1804926473817015735 * B, 0.2125862307855955516 * R + 0.7151703037034108499 * G + 0.07220049864333622685 * B, 0.01929721549174694484 * R + 0.1191838645808485318 * G + 0.950497125131579766 * B];
    }
  }, {
    key: "xyz2LAB",
    value: function xyz2LAB(xyz) {
      var whitePoint = Colors.d65WhitePointXYZ();
      var X = xyz[0] / whitePoint[0];
      var Y = xyz[1] / whitePoint[1];
      var Z = xyz[2] / whitePoint[2];
      X = Colors.labf(X);
      Y = Colors.labf(Y);
      Z = Colors.labf(Z);
      return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
    }
  }, {
    key: "lab2RGB",
    value: function lab2RGB(lab) {
      return Colors.xyz2RGB(Colors.lab2XYZ(lab));
    }
  }, {
    key: "lab2XYZ",
    value: function lab2XYZ(lab) {
      var L = (lab[0] + 16) / 116;
      var a = L + lab[1] / 500;
      var b = L - lab[2] / 200;
      var whitePoint = Colors.d65WhitePointXYZ();
      return [whitePoint[0] * Colors.labfInv(a), whitePoint[1] * Colors.labfInv(L), whitePoint[2] * Colors.labfInv(b)];
    }
  }, {
    key: "xyz2RGB",
    value: function xyz2RGB(xyz) {
      var R1 = 3.2406 * xyz[0] - 1.5372 * xyz[1] - 0.4986 * xyz[2];
      var G1 = -0.9689 * xyz[0] + 1.8758 * xyz[1] + 0.0415 * xyz[2];
      var B1 = 0.0557 * xyz[0] - 0.204 * xyz[1] + 1.057 * xyz[2];
      /* Force nonnegative values so that gamma correction is well-defined. */

      var minimumComponent = Math.min(R1, G1);
      minimumComponent = Math.min(minimumComponent, B1);

      if (minimumComponent < 0) {
        R1 -= minimumComponent;
        G1 -= minimumComponent;
        B1 -= minimumComponent;
      }
      /* Transform from RGB to R'G'B' */


      return [Colors.gammaCorrection(R1), Colors.gammaCorrection(G1), Colors.gammaCorrection(B1)];
    }
  }, {
    key: "labf",
    value: function labf(n) {
      if (n >= 8.85645167903563082e-3) {
        return Math.pow(n, 0.333333333333333);
      } else {
        return 841.0 / 108.0 * n + 4.0 / 29.0;
      }
    }
  }, {
    key: "labfInv",
    value: function labfInv(n) {
      if (n >= 0.206896551724137931) {
        return n * n * n;
      } else {
        return 108.0 / 841.0 * (n - 4.0 / 29.0);
      }
    }
  }]);

  return Colors;
}();

function datasetToDict(dataset) {
  var fileMetaInformationVersionArray = new Uint8Array(2);
  fileMetaInformationVersionArray[1] = 1;
  var TransferSyntaxUID = dataset._meta.TransferSyntaxUID && dataset._meta.TransferSyntaxUID.Value && dataset._meta.TransferSyntaxUID.Value[0] ? dataset._meta.TransferSyntaxUID.Value[0] : "1.2.840.10008.1.2.1";
  dataset._meta = {
    MediaStorageSOPClassUID: dataset.SOPClassUID,
    MediaStorageSOPInstanceUID: dataset.SOPInstanceUID,
    ImplementationVersionName: "dcmjs-0.0",
    TransferSyntaxUID: TransferSyntaxUID,
    ImplementationClassUID: "2.25.80302813137786398554742050926734630921603366648225212145404",
    FileMetaInformationVersion: fileMetaInformationVersionArray.buffer
  };
  var denaturalized = DicomMetaDictionary.denaturalizeDataset(dataset._meta);
  var dicomDict = new DicomDict(denaturalized);
  dicomDict.dict = DicomMetaDictionary.denaturalizeDataset(dataset);
  return dicomDict;
}

function datasetToBuffer(dataset) {
  return Buffer.from(datasetToDict(dataset).write());
}

function datasetToBlob(dataset) {
  var buffer = datasetToBuffer(dataset);
  return new Blob([buffer], {
    type: "application/dicom"
  });
}

var DerivedDataset = /*#__PURE__*/function () {
  function DerivedDataset(datasets) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, DerivedDataset);

    this.options = JSON.parse(JSON.stringify(options));
    var o = this.options;
    o.Manufacturer = options.Manufacturer || "Unspecified";
    o.ManufacturerModelName = options.ManufacturerModelName || "Unspecified";
    o.SeriesDescription = options.SeriesDescription || "Research Derived series";
    o.SeriesNumber = options.SeriesNumber || "99";
    o.SoftwareVersions = options.SoftwareVersions || "0";
    o.DeviceSerialNumber = options.DeviceSerialNumber || "1";
    var date = DicomMetaDictionary.date();
    var time = DicomMetaDictionary.time();
    o.SeriesDate = options.SeriesDate || date;
    o.SeriesTime = options.SeriesTime || time;
    o.ContentDate = options.ContentDate || date;
    o.ContentTime = options.ContentTime || time;
    o.SOPInstanceUID = options.SOPInstanceUID || DicomMetaDictionary.uid();
    o.SeriesInstanceUID = options.SeriesInstanceUID || DicomMetaDictionary.uid();
    o.ClinicalTrialTimePointID = options.ClinicalTrialTimePointID || "";
    o.ClinicalTrialCoordinatingCenterName = options.ClinicalTrialCoordinatingCenterName || "";
    o.ClinicalTrialSeriesID = options.ClinicalTrialSeriesID || "";
    o.ImageComments = options.ImageComments || "NOT FOR CLINICAL USE";
    o.ContentQualification = "RESEARCH";
    this.referencedDatasets = datasets; // list of one or more dicom-like object instances

    this.referencedDataset = this.referencedDatasets[0];
    this.dataset = {
      _vrMap: this.referencedDataset._vrMap,
      _meta: this.referencedDataset._meta
    };
    this.derive();
  }

  _createClass(DerivedDataset, [{
    key: "assignToDataset",
    value: function assignToDataset(data) {
      var _this = this;

      Object.keys(data).forEach(function (key) {
        return _this.dataset[key] = data[key];
      });
    }
  }, {
    key: "assignFromReference",
    value: function assignFromReference(tags) {
      var _this2 = this;

      tags.forEach(function (tag) {
        return _this2.dataset[tag] = _this2.referencedDataset[tag] || "";
      });
    }
  }, {
    key: "assignFromOptions",
    value: function assignFromOptions(tags) {
      var _this3 = this;

      tags.forEach(function (tag) {
        return _this3.dataset[tag] = _this3.options[tag] || "";
      });
    }
  }, {
    key: "derive",
    value: function derive() {
      // common for all instances in study
      this.assignFromReference(["AccessionNumber", "ReferringPhysicianName", "StudyDate", "StudyID", "StudyTime", "PatientName", "PatientID", "PatientBirthDate", "PatientSex", "PatientAge", "StudyInstanceUID", "StudyID"]);
      this.assignFromOptions(["Manufacturer", "SoftwareVersions", "DeviceSerialNumber", "ManufacturerModelName", "SeriesDescription", "SeriesNumber", "ImageComments", "SeriesDate", "SeriesTime", "ContentDate", "ContentTime", "ContentQualification", "SOPInstanceUID", "SeriesInstanceUID"]);
    }
  }], [{
    key: "copyDataset",
    value: function copyDataset(dataset) {
      // copies everything but the buffers
      return JSON.parse(JSON.stringify(dataset));
    }
  }]);

  return DerivedDataset;
}();

var DerivedPixels = /*#__PURE__*/function (_DerivedDataset) {
  _inherits(DerivedPixels, _DerivedDataset);

  var _super = _createSuper(DerivedPixels);

  function DerivedPixels(datasets) {
    var _this;

    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, DerivedPixels);

    _this = _super.call(this, datasets, options);
    var o = _this.options;
    o.ContentLabel = options.ContentLabel || "";
    o.ContentDescription = options.ContentDescription || "";
    o.ContentCreatorName = options.ContentCreatorName || "";
    return _this;
  } // this assumes a normalized multiframe input and will create
  // a multiframe derived image


  _createClass(DerivedPixels, [{
    key: "derive",
    value: function derive() {
      _get(_getPrototypeOf(DerivedPixels.prototype), "derive", this).call(this);

      this.assignToDataset({
        ImageType: ["DERIVED", "PRIMARY"],
        LossyImageCompression: "00",
        InstanceNumber: "1"
      });
      this.assignFromReference(["SOPClassUID", "Modality", "FrameOfReferenceUID", "PositionReferenceIndicator", "NumberOfFrames", "Rows", "Columns", "SamplesPerPixel", "PhotometricInterpretation", "BitsStored", "HighBit"]);
      this.assignFromOptions(["ContentLabel", "ContentDescription", "ContentCreatorName"]); //
      // TODO: more carefully copy only PixelMeasures and related
      // TODO: add derivation references
      //

      if (this.referencedDataset.SharedFunctionalGroupsSequence) {
        this.dataset.SharedFunctionalGroupsSequence = DerivedDataset.copyDataset(this.referencedDataset.SharedFunctionalGroupsSequence);
      }

      if (this.referencedDataset.PerFrameFunctionalGroupsSequence) {
        this.dataset.PerFrameFunctionalGroupsSequence = DerivedDataset.copyDataset(this.referencedDataset.PerFrameFunctionalGroupsSequence);
      } // make an array of zeros for the pixels


      this.dataset.PixelData = new ArrayBuffer(this.referencedDataset.PixelData.byteLength);
    }
  }]);

  return DerivedPixels;
}(DerivedDataset);

var DerivedImage = /*#__PURE__*/function (_DerivedPixels) {
  _inherits(DerivedImage, _DerivedPixels);

  var _super = _createSuper(DerivedImage);

  function DerivedImage(datasets) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, DerivedImage);

    return _super.call(this, datasets, options);
  }

  _createClass(DerivedImage, [{
    key: "derive",
    value: function derive() {
      _get(_getPrototypeOf(DerivedImage.prototype), "derive", this).call(this);

      this.assignFromReference(["WindowCenter", "WindowWidth", "BitsAllocated", "PixelRepresentation", "BodyPartExamined", "Laterality", "PatientPosition", "RescaleSlope", "RescaleIntercept", "PixelPresentation", "VolumetricProperties", "VolumeBasedCalculationTechnique", "PresentationLUTShape"]);
    }
  }]);

  return DerivedImage;
}(DerivedPixels);

var Normalizer = /*#__PURE__*/function () {
  function Normalizer(datasets) {
    _classCallCheck(this, Normalizer);

    this.datasets = datasets; // one or more dicom-like object instances

    this.dataset = undefined; // a normalized multiframe dicom object instance
  }

  _createClass(Normalizer, [{
    key: "normalize",
    value: function normalize() {
      return "No normalization defined";
    }
  }], [{
    key: "consistentSOPClassUIDs",
    value: function consistentSOPClassUIDs(datasets) {
      // return sopClassUID if all exist and match, otherwise undefined
      var sopClassUID;
      datasets.forEach(function (dataset) {
        if (!dataset.SOPClassUID) {
          return undefined;
        }

        if (!sopClassUID) {
          sopClassUID = dataset.SOPClassUID;
        }

        if (dataset.SOPClassUID !== sopClassUID) {
          log.error("inconsistent sopClassUIDs: ", dataset.SOPClassUID, sopClassUID);
          return undefined;
        }
      });
      return sopClassUID;
    }
  }, {
    key: "normalizerForSOPClassUID",
    value: function normalizerForSOPClassUID(sopClassUID) {
      sopClassUID = sopClassUID.replace(/[^0-9.]/g, ""); // TODO: clean all VRs as part of normalizing

      var toUID = DicomMetaDictionary.sopClassUIDsByName;
      var sopClassUIDMap = {};
      sopClassUIDMap[toUID.CTImage] = CTImageNormalizer;
      sopClassUIDMap[toUID.ParametricMapStorage] = PMImageNormalizer;
      sopClassUIDMap[toUID.MRImage] = MRImageNormalizer;
      sopClassUIDMap[toUID.EnhancedCTImage] = EnhancedCTImageNormalizer;
      sopClassUIDMap[toUID.LegacyConvertedEnhancedCTImage] = EnhancedCTImageNormalizer;
      sopClassUIDMap[toUID.EnhancedMRImage] = EnhancedMRImageNormalizer;
      sopClassUIDMap[toUID.LegacyConvertedEnhancedMRImage] = EnhancedMRImageNormalizer;
      sopClassUIDMap[toUID.EnhancedUSVolume] = EnhancedUSVolumeNormalizer;
      sopClassUIDMap[toUID.PETImage] = PETImageNormalizer;
      sopClassUIDMap[toUID.EnhancedPETImage] = PETImageNormalizer;
      sopClassUIDMap[toUID.LegacyConvertedEnhancedPETImage] = PETImageNormalizer;
      sopClassUIDMap[toUID.Segmentation] = SEGImageNormalizer;
      sopClassUIDMap[toUID.DeformableSpatialRegistration] = DSRNormalizer;
      return sopClassUIDMap[sopClassUID];
    }
  }, {
    key: "isMultiframeSOPClassUID",
    value: function isMultiframeSOPClassUID(sopClassUID) {
      var toUID = DicomMetaDictionary.sopClassUIDsByName;
      var multiframeSOPClasses = [toUID.EnhancedMRImage, toUID.LegacyConvertedEnhancedMRImage, toUID.EnhancedCTImage, toUID.LegacyConvertedEnhancedCTImage, toUID.EnhancedUSVolume, toUID.EnhancedPETImage, toUID.LegacyConvertedEnhancedPETImage, toUID.Segmentation, toUID.ParametricMapStorage];
      return multiframeSOPClasses.indexOf(sopClassUID) !== -1;
    }
  }, {
    key: "isMultiframeDataset",
    value: function isMultiframeDataset() {
      var ds = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.dataset;
      var sopClassUID = ds.SOPClassUID.replace(/[^0-9.]/g, ""); // TODO: clean all VRs as part of normalizing

      return Normalizer.isMultiframeSOPClassUID(sopClassUID);
    }
  }, {
    key: "normalizeToDataset",
    value: function normalizeToDataset(datasets) {
      var sopClassUID = Normalizer.consistentSOPClassUIDs(datasets);
      var normalizerClass = Normalizer.normalizerForSOPClassUID(sopClassUID);

      if (!normalizerClass) {
        log.error("no normalizerClass for ", sopClassUID);
        return undefined;
      }

      var normalizer = new normalizerClass(datasets);
      normalizer.normalize();
      return normalizer.dataset;
    }
  }]);

  return Normalizer;
}();

var ImageNormalizer = /*#__PURE__*/function (_Normalizer) {
  _inherits(ImageNormalizer, _Normalizer);

  var _super = _createSuper(ImageNormalizer);

  function ImageNormalizer() {
    _classCallCheck(this, ImageNormalizer);

    return _super.apply(this, arguments);
  }

  _createClass(ImageNormalizer, [{
    key: "normalize",
    value: function normalize() {
      this.convertToMultiframe();
      this.normalizeMultiframe();
    }
  }, {
    key: "convertToMultiframe",
    value: function convertToMultiframe() {
      if (this.datasets.length === 1 && Normalizer.isMultiframeDataset(this.datasets[0])) {
        // already a multiframe, so just use it
        this.dataset = this.datasets[0];
        return;
      }

      this.derivation = new DerivedImage(this.datasets);
      this.dataset = this.derivation.dataset;
      var ds = this.dataset; // create a new multiframe from the source datasets
      // fill in only those elements required to make a valid image
      // for volumetric processing

      var referenceDataset = this.datasets[0];
      ds.NumberOfFrames = this.datasets.length; // TODO: develop sets of elements to copy over in loops

      ds.SOPClassUID = referenceDataset.SOPClassUID;
      ds.Rows = referenceDataset.Rows;
      ds.Columns = referenceDataset.Columns;
      ds.BitsAllocated = referenceDataset.BitsAllocated;
      ds.PixelRepresentation = referenceDataset.PixelRepresentation;
      ds.RescaleSlope = referenceDataset.RescaleSlope || "1";
      ds.RescaleIntercept = referenceDataset.RescaleIntercept || "0"; //ds.BurnedInAnnotation = referenceDataset.BurnedInAnnotation || "YES";
      // sort
      // https://github.com/pieper/Slicer3/blob/master/Base/GUI/Tcl/LoadVolume.tcl
      // TODO: add spacing checks:
      // https://github.com/Slicer/Slicer/blob/master/Modules/Scripted/DICOMPlugins/DICOMScalarVolumePlugin.py#L228-L250
      // TODO: put this information into the Shared and PerFrame functional groups
      // TODO: sorting of frames could happen in normalizeMultiframe instead, since other
      // multiframe converters may not sort the images
      // TODO: sorting can be seen as part of generation of the Dimension Multiframe Dimension Module
      // and should really be done in an acquisition-specific way (e.g. for DCE)

      var referencePosition = referenceDataset.ImagePositionPatient;
      var rowVector = referenceDataset.ImageOrientationPatient.slice(0, 3);
      var columnVector = referenceDataset.ImageOrientationPatient.slice(3, 6);
      var scanAxis = ImageNormalizer.vec3CrossProduct(rowVector, columnVector);
      var distanceDatasetPairs = [];
      this.datasets.forEach(function (dataset) {
        var position = dataset.ImagePositionPatient.slice();
        var positionVector = ImageNormalizer.vec3Subtract(position, referencePosition);
        var distance = ImageNormalizer.vec3Dot(positionVector, scanAxis);
        distanceDatasetPairs.push([distance, dataset]);
      });
      distanceDatasetPairs.sort(function (a, b) {
        return b[0] - a[0];
      }); // assign array buffers

      if (ds.BitsAllocated !== 16) {
        log.error("Only works with 16 bit data, not " + String(this.dataset.BitsAllocated));
      }

      if (referenceDataset._vrMap && !referenceDataset._vrMap.PixelData) {
        log.warn("No vr map given for pixel data, using OW");
        ds._vrMap = {
          PixelData: "OW"
        };
      } else {
        ds._vrMap = {
          PixelData: referenceDataset._vrMap.PixelData
        };
      }

      var frameSize = referenceDataset.PixelData.byteLength;
      ds.PixelData = new ArrayBuffer(ds.NumberOfFrames * frameSize);
      var frame = 0;
      distanceDatasetPairs.forEach(function (pair) {
        var dataset = pair[1];
        var pixels = new Uint16Array(dataset.PixelData);
        var frameView = new Uint16Array(ds.PixelData, frame * frameSize, frameSize / 2);

        try {
          frameView.set(pixels);
        } catch (e) {
          if (e instanceof RangeError) {
            var message = "Error inserting pixels in PixelData\n" + "frameSize ".concat(frameSize, "\n") + "NumberOfFrames ".concat(ds.NumberOfFrames, "\n") + "pair ".concat(pair, "\n") + "dataset PixelData size ".concat(dataset.PixelData.length);
            log.error(message);
          }
        }

        frame++;
      });

      if (ds.NumberOfFrames < 2) {
        // TODO
        log.error("Cannot populate shared groups uniquely without multiple frames");
      }

      var _distanceDatasetPairs = _slicedToArray(distanceDatasetPairs[0], 2),
          distance0 = _distanceDatasetPairs[0],
          dataset0 = _distanceDatasetPairs[1];

      var distance1 = distanceDatasetPairs[1][0]; //
      // make the functional groups
      //
      // shared

      var SpacingBetweenSlices = Math.abs(distance1 - distance0);
      ds.SharedFunctionalGroupsSequence = {
        PlaneOrientationSequence: {
          ImageOrientationPatient: dataset0.ImageOrientationPatient
        },
        PixelMeasuresSequence: {
          PixelSpacing: dataset0.PixelSpacing,
          SpacingBetweenSlices: SpacingBetweenSlices,
          SliceThickness: SpacingBetweenSlices
        }
      };
      ds.ReferencedSeriesSequence = {
        SeriesInstanceUID: dataset0.SeriesInstanceUID,
        ReferencedInstanceSequence: []
      }; // per-frame

      ds.PerFrameFunctionalGroupsSequence = []; // copy over each datasets window/level into the per-frame groups
      // and set the referenced series uid

      distanceDatasetPairs.forEach(function (pair) {
        var dataset = pair[1];
        ds.PerFrameFunctionalGroupsSequence.push({
          PlanePositionSequence: {
            ImagePositionPatient: dataset.ImagePositionPatient
          },
          FrameVOILUTSequence: {
            WindowCenter: dataset.WindowCenter,
            WindowWidth: dataset.WindowWidth
          }
        });
        ds.ReferencedSeriesSequence.ReferencedInstanceSequence.push({
          ReferencedSOPClassUID: dataset.SOPClassUID,
          ReferencedSOPInstanceUID: dataset.SOPInstanceUID
        });
      });
      var dimensionUID = DicomMetaDictionary.uid();
      this.dataset.DimensionOrganizationSequence = {
        DimensionOrganizationUID: dimensionUID
      };
      this.dataset.DimensionIndexSequence = [{
        DimensionOrganizationUID: dimensionUID,
        DimensionIndexPointer: 2097202,
        FunctionalGroupPointer: 2134291,
        // PlanePositionSequence
        DimensionDescriptionLabel: "ImagePositionPatient"
      }];
    }
  }, {
    key: "normalizeMultiframe",
    value: function normalizeMultiframe() {
      var ds = this.dataset;

      if (!ds.NumberOfFrames) {
        log.error("Missing number or frames not supported");
        return;
      }

      if (!ds.PixelRepresentation) {
        // Required tag: guess signed
        ds.PixelRepresentation = 1;
      }

      if (!ds.StudyID || ds.StudyID === "") {
        // Required tag: fill in if needed
        ds.StudyID = "No Study ID";
      }

      var validLateralities = ["R", "L"];

      if (validLateralities.indexOf(ds.Laterality) === -1) {
        delete ds.Laterality;
      }

      if (!ds.PresentationLUTShape) {
        ds.PresentationLUTShape = "IDENTITY";
      }

      if (!ds.SharedFunctionalGroupsSequence) {
        log.error("Can only process multiframe data with SharedFunctionalGroupsSequence");
      } // TODO: special case!


      if (ds.BodyPartExamined === "PROSTATE") {
        ds.SharedFunctionalGroupsSequence.FrameAnatomySequence = {
          AnatomicRegionSequence: {
            CodeValue: "T-9200B",
            CodingSchemeDesignator: "SRT",
            CodeMeaning: "Prostate"
          },
          FrameLaterality: "U"
        };
      }

      var rescaleIntercept = ds.RescaleIntercept || 0;
      var rescaleSlope = ds.RescaleSlope || 1;
      ds.SharedFunctionalGroupsSequence.PixelValueTransformationSequence = {
        RescaleIntercept: rescaleIntercept,
        RescaleSlope: rescaleSlope,
        RescaleType: "US"
      };
      var frameNumber = 1;
      this.datasets.forEach(function (dataset) {
        if (ds.NumberOfFrames === 1) ds.PerFrameFunctionalGroupsSequence = [ds.PerFrameFunctionalGroupsSequence];
        ds.PerFrameFunctionalGroupsSequence[frameNumber - 1].FrameContentSequence = {
          FrameAcquisitionDuration: 0,
          StackID: 1,
          InStackPositionNumber: frameNumber,
          DimensionIndexValues: frameNumber
        };
        var frameTime = dataset.AcquisitionDate + dataset.AcquisitionTime;

        if (!isNaN(frameTime)) {
          var frameContentSequence = ds.PerFrameFunctionalGroupsSequence[frameNumber - 1].FrameContentSequence;
          frameContentSequence.FrameAcquisitionDateTime = frameTime;
          frameContentSequence.FrameReferenceDateTime = frameTime;
        }

        frameNumber++;
      }); //
      // TODO: convert this to shared functional group not top level element
      //

      if (ds.WindowCenter && ds.WindowWidth) {
        // if they exist as single values, make them lists for consistency
        if (!Array.isArray(ds.WindowCenter)) {
          ds.WindowCenter = [ds.WindowCenter];
        }

        if (!Array.isArray(ds.WindowWidth)) {
          ds.WindowWidth = [ds.WindowWidth];
        }
      }

      if (!ds.WindowCenter || !ds.WindowWidth) {
        // if they don't exist, make them empty lists and try to initialize them
        ds.WindowCenter = []; // both must exist and be the same length

        ds.WindowWidth = []; // provide a volume-level window/level guess (mean of per-frame)

        if (ds.PerFrameFunctionalGroupsSequence) {
          var wcww = {
            center: 0,
            width: 0,
            count: 0
          };
          ds.PerFrameFunctionalGroupsSequence.forEach(function (functionalGroup) {
            if (functionalGroup.FrameVOILUT) {
              var wc = functionalGroup.FrameVOILUTSequence.WindowCenter;
              var ww = functionalGroup.FrameVOILUTSequence.WindowWidth;

              if (functionalGroup.FrameVOILUTSequence && wc && ww) {
                if (Array.isArray(wc)) {
                  wc = wc[0];
                }

                if (Array.isArray(ww)) {
                  ww = ww[0];
                }

                wcww.center += Number(wc);
                wcww.width += Number(ww);
                wcww.count++;
              }
            }
          });

          if (wcww.count > 0) {
            ds.WindowCenter.push(String(wcww.center / wcww.count));
            ds.WindowWidth.push(String(wcww.width / wcww.count));
          }
        }
      } // last gasp, pick an arbitrary default


      if (ds.WindowCenter.length === 0) {
        ds.WindowCenter = [300];
      }

      if (ds.WindowWidth.length === 0) {
        ds.WindowWidth = [500];
      }
    }
  }], [{
    key: "vec3CrossProduct",
    value: function vec3CrossProduct(a, b) {
      var ax = a[0],
          ay = a[1],
          az = a[2],
          bx = b[0],
          by = b[1],
          bz = b[2];
      var out = [];
      out[0] = ay * bz - az * by;
      out[1] = az * bx - ax * bz;
      out[2] = ax * by - ay * bx;
      return out;
    }
  }, {
    key: "vec3Subtract",
    value: function vec3Subtract(a, b) {
      var out = [];
      out[0] = a[0] - b[0];
      out[1] = a[1] - b[1];
      out[2] = a[2] - b[2];
      return out;
    }
  }, {
    key: "vec3Dot",
    value: function vec3Dot(a, b) {
      return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }
  }]);

  return ImageNormalizer;
}(Normalizer);

var MRImageNormalizer = /*#__PURE__*/function (_ImageNormalizer) {
  _inherits(MRImageNormalizer, _ImageNormalizer);

  var _super2 = _createSuper(MRImageNormalizer);

  function MRImageNormalizer() {
    _classCallCheck(this, MRImageNormalizer);

    return _super2.apply(this, arguments);
  }

  _createClass(MRImageNormalizer, [{
    key: "normalize",
    value: function normalize() {
      _get(_getPrototypeOf(MRImageNormalizer.prototype), "normalize", this).call(this); // TODO: make specialization for LegacyConverted vs normal EnhanceMRImage
      //let toUID = DicomMetaDictionary.sopClassUIDsByName;


      this.dataset.SOPClassUID = "LegacyConvertedEnhancedMRImage"; //this.dataset.SOPClassUID = toUID.EnhancedMRImage;
    }
  }, {
    key: "normalizeMultiframe",
    value: function normalizeMultiframe() {
      _get(_getPrototypeOf(MRImageNormalizer.prototype), "normalizeMultiframe", this).call(this);

      var ds = this.dataset;

      if (!ds.ImageType || !ds.ImageType.constructor || ds.ImageType.constructor.name != "Array" || ds.ImageType.length != 4) {
        ds.ImageType = ["ORIGINAL", "PRIMARY", "OTHER", "NONE"];
      }

      ds.SharedFunctionalGroupsSequence.MRImageFrameTypeSequence = {
        FrameType: ds.ImageType,
        PixelPresentation: "MONOCHROME",
        VolumetricProperties: "VOLUME",
        VolumeBasedCalculationTechnique: "NONE",
        ComplexImageComponent: "MAGNITUDE",
        AcquisitionContrast: "UNKNOWN"
      };
    }
  }]);

  return MRImageNormalizer;
}(ImageNormalizer);

var EnhancedCTImageNormalizer = /*#__PURE__*/function (_ImageNormalizer2) {
  _inherits(EnhancedCTImageNormalizer, _ImageNormalizer2);

  var _super3 = _createSuper(EnhancedCTImageNormalizer);

  function EnhancedCTImageNormalizer() {
    _classCallCheck(this, EnhancedCTImageNormalizer);

    return _super3.apply(this, arguments);
  }

  _createClass(EnhancedCTImageNormalizer, [{
    key: "normalize",
    value: function normalize() {
      _get(_getPrototypeOf(EnhancedCTImageNormalizer.prototype), "normalize", this).call(this);
    }
  }]);

  return EnhancedCTImageNormalizer;
}(ImageNormalizer);

var EnhancedMRImageNormalizer = /*#__PURE__*/function (_ImageNormalizer3) {
  _inherits(EnhancedMRImageNormalizer, _ImageNormalizer3);

  var _super4 = _createSuper(EnhancedMRImageNormalizer);

  function EnhancedMRImageNormalizer() {
    _classCallCheck(this, EnhancedMRImageNormalizer);

    return _super4.apply(this, arguments);
  }

  _createClass(EnhancedMRImageNormalizer, [{
    key: "normalize",
    value: function normalize() {
      _get(_getPrototypeOf(EnhancedMRImageNormalizer.prototype), "normalize", this).call(this);
    }
  }]);

  return EnhancedMRImageNormalizer;
}(ImageNormalizer);

var EnhancedUSVolumeNormalizer = /*#__PURE__*/function (_ImageNormalizer4) {
  _inherits(EnhancedUSVolumeNormalizer, _ImageNormalizer4);

  var _super5 = _createSuper(EnhancedUSVolumeNormalizer);

  function EnhancedUSVolumeNormalizer() {
    _classCallCheck(this, EnhancedUSVolumeNormalizer);

    return _super5.apply(this, arguments);
  }

  _createClass(EnhancedUSVolumeNormalizer, [{
    key: "normalize",
    value: function normalize() {
      _get(_getPrototypeOf(EnhancedUSVolumeNormalizer.prototype), "normalize", this).call(this);
    }
  }]);

  return EnhancedUSVolumeNormalizer;
}(ImageNormalizer);

var CTImageNormalizer = /*#__PURE__*/function (_ImageNormalizer5) {
  _inherits(CTImageNormalizer, _ImageNormalizer5);

  var _super6 = _createSuper(CTImageNormalizer);

  function CTImageNormalizer() {
    _classCallCheck(this, CTImageNormalizer);

    return _super6.apply(this, arguments);
  }

  _createClass(CTImageNormalizer, [{
    key: "normalize",
    value: function normalize() {
      _get(_getPrototypeOf(CTImageNormalizer.prototype), "normalize", this).call(this); // TODO: provide option at export to swap in LegacyConverted UID


      var toUID = DicomMetaDictionary.sopClassUIDsByName; //this.dataset.SOPClassUID = "LegacyConvertedEnhancedCTImage";

      this.dataset.SOPClassUID = toUID.EnhancedCTImage;
    }
  }]);

  return CTImageNormalizer;
}(ImageNormalizer);

var PETImageNormalizer = /*#__PURE__*/function (_ImageNormalizer6) {
  _inherits(PETImageNormalizer, _ImageNormalizer6);

  var _super7 = _createSuper(PETImageNormalizer);

  function PETImageNormalizer() {
    _classCallCheck(this, PETImageNormalizer);

    return _super7.apply(this, arguments);
  }

  _createClass(PETImageNormalizer, [{
    key: "normalize",
    value: function normalize() {
      _get(_getPrototypeOf(PETImageNormalizer.prototype), "normalize", this).call(this); // TODO: provide option at export to swap in LegacyConverted UID


      var toUID = DicomMetaDictionary.sopClassUIDsByName; //this.dataset.SOPClassUID = "LegacyConvertedEnhancedPETImage";

      this.dataset.SOPClassUID = toUID.EnhancedPETImage;
    }
  }]);

  return PETImageNormalizer;
}(ImageNormalizer);

var SEGImageNormalizer = /*#__PURE__*/function (_ImageNormalizer7) {
  _inherits(SEGImageNormalizer, _ImageNormalizer7);

  var _super8 = _createSuper(SEGImageNormalizer);

  function SEGImageNormalizer() {
    _classCallCheck(this, SEGImageNormalizer);

    return _super8.apply(this, arguments);
  }

  _createClass(SEGImageNormalizer, [{
    key: "normalize",
    value: function normalize() {
      _get(_getPrototypeOf(SEGImageNormalizer.prototype), "normalize", this).call(this);
    }
  }]);

  return SEGImageNormalizer;
}(ImageNormalizer);

var PMImageNormalizer = /*#__PURE__*/function (_ImageNormalizer8) {
  _inherits(PMImageNormalizer, _ImageNormalizer8);

  var _super9 = _createSuper(PMImageNormalizer);

  function PMImageNormalizer() {
    _classCallCheck(this, PMImageNormalizer);

    return _super9.apply(this, arguments);
  }

  _createClass(PMImageNormalizer, [{
    key: "normalize",
    value: function normalize() {
      _get(_getPrototypeOf(PMImageNormalizer.prototype), "normalize", this).call(this);

      var ds = this.datasets[0];

      if (ds.BitsAllocated !== 32) {
        log.error("Only works with 32 bit data, not " + String(ds.BitsAllocated));
      }
    }
  }]);

  return PMImageNormalizer;
}(ImageNormalizer);

var DSRNormalizer = /*#__PURE__*/function (_Normalizer2) {
  _inherits(DSRNormalizer, _Normalizer2);

  var _super10 = _createSuper(DSRNormalizer);

  function DSRNormalizer() {
    _classCallCheck(this, DSRNormalizer);

    return _super10.apply(this, arguments);
  }

  _createClass(DSRNormalizer, [{
    key: "normalize",
    value: function normalize() {
      this.dataset = this.datasets[0]; // only one dataset per series and for now we assume it is normalized
    }
  }]);

  return DSRNormalizer;
}(Normalizer);

var Segmentation$4 = /*#__PURE__*/function (_DerivedPixels) {
  _inherits(Segmentation, _DerivedPixels);

  var _super = _createSuper(Segmentation);

  function Segmentation(datasets) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
      includeSliceSpacing: true
    };

    _classCallCheck(this, Segmentation);

    return _super.call(this, datasets, options);
  }

  _createClass(Segmentation, [{
    key: "derive",
    value: function derive() {
      _get(_getPrototypeOf(Segmentation.prototype), "derive", this).call(this);

      this.assignToDataset({
        SOPClassUID: DicomMetaDictionary.sopClassUIDsByName.Segmentation,
        Modality: "SEG",
        SamplesPerPixel: "1",
        PhotometricInterpretation: "MONOCHROME2",
        BitsAllocated: "1",
        BitsStored: "1",
        HighBit: "0",
        PixelRepresentation: "0",
        LossyImageCompression: "00",
        SegmentationType: "BINARY",
        ContentLabel: "SEGMENTATION"
      });
      var dimensionUID = DicomMetaDictionary.uid();
      this.dataset.DimensionOrganizationSequence = {
        DimensionOrganizationUID: dimensionUID
      };
      this.dataset.DimensionIndexSequence = [{
        DimensionOrganizationUID: dimensionUID,
        DimensionIndexPointer: 6422539,
        FunctionalGroupPointer: 6422538,
        // SegmentIdentificationSequence
        DimensionDescriptionLabel: "ReferencedSegmentNumber"
      }, {
        DimensionOrganizationUID: dimensionUID,
        DimensionIndexPointer: 2097202,
        FunctionalGroupPointer: 2134291,
        // PlanePositionSequence
        DimensionDescriptionLabel: "ImagePositionPatient"
      }];
      this.dataset.SegmentSequence = []; // TODO: check logic here.
      // If the referenced dataset itself references a series, then copy.
      // Otherwise, reference the dataset itself.
      // This should allow Slicer and others to get the correct original
      // images when loading Legacy Converted Images, but it's a workaround
      // that really doesn't belong here.

      if (this.referencedDataset.ReferencedSeriesSequence) {
        this.dataset.ReferencedSeriesSequence = DerivedDataset.copyDataset(this.referencedDataset.ReferencedSeriesSequence);
      } else {
        var ReferencedInstanceSequence = [];

        for (var i = 0; i < this.referencedDatasets.length; i++) {
          ReferencedInstanceSequence.push({
            ReferencedSOPClassUID: this.referencedDatasets[i].SOPClassUID,
            ReferencedSOPInstanceUID: this.referencedDatasets[i].SOPInstanceUID
          });
        }

        this.dataset.ReferencedSeriesSequence = {
          SeriesInstanceUID: this.referencedDataset.SeriesInstanceUID,
          StudyInstanceUID: this.referencedDataset.StudyInstanceUID,
          ReferencedInstanceSequence: ReferencedInstanceSequence
        };
      }

      if (!this.options.includeSliceSpacing) {
        // per dciodvfy this should not be included, but dcmqi/Slicer requires it
        delete this.dataset.SharedFunctionalGroupsSequence.PixelMeasuresSequence.SpacingBetweenSlices;
      }

      if (this.dataset.SharedFunctionalGroupsSequence.PixelValueTransformationSequence) {
        // If derived from a CT, this shouldn't be left in the SEG.
        delete this.dataset.SharedFunctionalGroupsSequence.PixelValueTransformationSequence;
      } // The pixelData array needs to be defined once you know how many frames you'll have.


      this.dataset.PixelData = undefined;
      this.dataset.NumberOfFrames = 0;
      this.dataset.PerFrameFunctionalGroupsSequence = [];
    }
    /**
     * setNumberOfFrames - Sets the number of frames of the segmentation object
     * and allocates (non-bitpacked) memory for the PixelData for constuction.
     *
     * @param  {type} NumberOfFrames The number of segmentation frames.
     */

  }, {
    key: "setNumberOfFrames",
    value: function setNumberOfFrames(NumberOfFrames) {
      var dataset = this.dataset;
      dataset.NumberOfFrames = NumberOfFrames;
      dataset.PixelData = new ArrayBuffer(dataset.Rows * dataset.Columns * NumberOfFrames);
    }
    /**
     * bitPackPixelData - Bitpacks the pixeldata, should be called after all
     * segments are addded.
     *
     * @returns {type}  description
     */

  }, {
    key: "bitPackPixelData",
    value: function bitPackPixelData() {
      if (this.isBitpacked) {
        console.warn("This.bitPackPixelData has already been called, it should only be called once, when all frames have been added. Exiting.");
      }

      var dataset = this.dataset;
      var unpackedPixelData = dataset.PixelData;
      var uInt8ViewUnpackedPixelData = new Uint8Array(unpackedPixelData);
      var bitPackedPixelData = BitArray.pack(uInt8ViewUnpackedPixelData);
      dataset.PixelData = bitPackedPixelData.buffer;
      this.isBitpacked = true;
    }
    /**
     * addSegmentFromLabelmap - Adds a segment to the dataset,
     * where the labelmaps are a set of 2D labelmaps, from which to extract the binary maps.
     *
     * @param  {type} Segment   The segment metadata.
     * @param  {Uint8Array[]} labelmaps labelmap arrays for each index of referencedFrameNumbers.
     * @param  {number}  segmentIndexInLabelmap The segment index to extract from the labelmap
     *    (might be different to the segment metadata depending on implementation).
     * @param  {number[]} referencedFrameNumbers  The frames that the
     *                                            segmentation references.
     *
     */

  }, {
    key: "addSegmentFromLabelmap",
    value: function addSegmentFromLabelmap(Segment, labelmaps, segmentIndexInLabelmap, referencedFrameNumbers) {
      if (this.dataset.NumberOfFrames === 0) {
        throw new Error("Must set the total number of frames via setNumberOfFrames() before adding segments to the segmentation.");
      }

      this._addSegmentPixelDataFromLabelmaps(labelmaps, segmentIndexInLabelmap);

      var ReferencedSegmentNumber = this._addSegmentMetadata(Segment);

      this._addPerFrameFunctionalGroups(ReferencedSegmentNumber, referencedFrameNumbers);
    }
  }, {
    key: "_addSegmentPixelDataFromLabelmaps",
    value: function _addSegmentPixelDataFromLabelmaps(labelmaps, segmentIndex) {
      var dataset = this.dataset;
      var existingFrames = dataset.PerFrameFunctionalGroupsSequence.length;
      var sliceLength = dataset.Rows * dataset.Columns;
      var byteOffset = existingFrames * sliceLength;
      var pixelDataUInt8View = new Uint8Array(dataset.PixelData, byteOffset, labelmaps.length * sliceLength);

      var occupiedValue = this._getOccupiedValue();

      for (var l = 0; l < labelmaps.length; l++) {
        var labelmap = labelmaps[l];

        for (var i = 0; i < labelmap.length; i++) {
          if (labelmap[i] === segmentIndex) {
            pixelDataUInt8View[l * sliceLength + i] = occupiedValue;
          }
        }
      }
    }
  }, {
    key: "_getOccupiedValue",
    value: function _getOccupiedValue() {
      if (this.dataset.SegmentationType === "FRACTIONAL") {
        return 255;
      }

      return 1;
    }
    /**
     * addSegment - Adds a segment to the dataset.
     *
     * @param  {type} Segment   The segment metadata.
     * @param  {Uint8Array} pixelData The pixelData array containing all frames
     *                                of the segmentation.
     * @param  {Number[]} referencedFrameNumbers  The frames that the
     *                                            segmentation references.
     *
     */

  }, {
    key: "addSegment",
    value: function addSegment(Segment, pixelData, referencedFrameNumbers) {
      if (this.dataset.NumberOfFrames === 0) {
        throw new Error("Must set the total number of frames via setNumberOfFrames() before adding segments to the segmentation.");
      }

      this._addSegmentPixelData(pixelData);

      var ReferencedSegmentNumber = this._addSegmentMetadata(Segment);

      this._addPerFrameFunctionalGroups(ReferencedSegmentNumber, referencedFrameNumbers);
    }
  }, {
    key: "_addSegmentPixelData",
    value: function _addSegmentPixelData(pixelData) {
      var dataset = this.dataset;
      var existingFrames = dataset.PerFrameFunctionalGroupsSequence.length;
      var sliceLength = dataset.Rows * dataset.Columns;
      var byteOffset = existingFrames * sliceLength;
      var pixelDataUInt8View = new Uint8Array(dataset.PixelData, byteOffset, pixelData.length);

      for (var i = 0; i < pixelData.length; i++) {
        pixelDataUInt8View[i] = pixelData[i];
      }
    }
  }, {
    key: "_addPerFrameFunctionalGroups",
    value: function _addPerFrameFunctionalGroups(ReferencedSegmentNumber, referencedFrameNumbers) {
      var PerFrameFunctionalGroupsSequence = this.dataset.PerFrameFunctionalGroupsSequence;
      var ReferencedSeriesSequence = this.referencedDataset.ReferencedSeriesSequence;

      for (var i = 0; i < referencedFrameNumbers.length; i++) {
        var frameNumber = referencedFrameNumbers[i];
        var perFrameFunctionalGroups = {};
        perFrameFunctionalGroups.PlanePositionSequence = DerivedDataset.copyDataset(this.referencedDataset.PerFrameFunctionalGroupsSequence[frameNumber - 1].PlanePositionSequence); // If the PlaneOrientationSequence is not in the SharedFunctionalGroupsSequence,
        // extract it from the PerFrameFunctionalGroupsSequence.

        if (!this.dataset.SharedFunctionalGroupsSequence.PlaneOrientationSequence) {
          perFrameFunctionalGroups.PlaneOrientationSequence = DerivedDataset.copyDataset(this.referencedDataset.PerFrameFunctionalGroupsSequence[frameNumber - 1].PlaneOrientationSequence);
        }

        perFrameFunctionalGroups.FrameContentSequence = {
          DimensionIndexValues: [ReferencedSegmentNumber, frameNumber]
        };
        perFrameFunctionalGroups.SegmentIdentificationSequence = {
          ReferencedSegmentNumber: ReferencedSegmentNumber
        };
        var ReferencedSOPClassUID = void 0;
        var ReferencedSOPInstanceUID = void 0;
        var ReferencedFrameNumber = void 0;

        if (ReferencedSeriesSequence) {
          var referencedInstanceSequenceI = ReferencedSeriesSequence.ReferencedInstanceSequence[frameNumber - 1];
          ReferencedSOPClassUID = referencedInstanceSequenceI.ReferencedSOPClassUID;
          ReferencedSOPInstanceUID = referencedInstanceSequenceI.ReferencedSOPInstanceUID;

          if (Normalizer.isMultiframeSOPClassUID(ReferencedSOPClassUID)) {
            ReferencedFrameNumber = frameNumber;
          }
        } else {
          ReferencedSOPClassUID = this.referencedDataset.SOPClassUID;
          ReferencedSOPInstanceUID = this.referencedDataset.SOPInstanceUID;
          ReferencedFrameNumber = frameNumber;
        }

        if (ReferencedFrameNumber) {
          perFrameFunctionalGroups.DerivationImageSequence = {
            SourceImageSequence: {
              ReferencedSOPClassUID: ReferencedSOPClassUID,
              ReferencedSOPInstanceUID: ReferencedSOPInstanceUID,
              ReferencedFrameNumber: ReferencedFrameNumber,
              PurposeOfReferenceCodeSequence: {
                CodeValue: "121322",
                CodingSchemeDesignator: "DCM",
                CodeMeaning: "Source image for image processing operation"
              }
            },
            DerivationCodeSequence: {
              CodeValue: "113076",
              CodingSchemeDesignator: "DCM",
              CodeMeaning: "Segmentation"
            }
          };
        } else {
          perFrameFunctionalGroups.DerivationImageSequence = {
            SourceImageSequence: {
              ReferencedSOPClassUID: ReferencedSOPClassUID,
              ReferencedSOPInstanceUID: ReferencedSOPInstanceUID,
              PurposeOfReferenceCodeSequence: {
                CodeValue: "121322",
                CodingSchemeDesignator: "DCM",
                CodeMeaning: "Source image for image processing operation"
              }
            },
            DerivationCodeSequence: {
              CodeValue: "113076",
              CodingSchemeDesignator: "DCM",
              CodeMeaning: "Segmentation"
            }
          };
        }

        PerFrameFunctionalGroupsSequence.push(perFrameFunctionalGroups);
      }
    }
  }, {
    key: "_addSegmentMetadata",
    value: function _addSegmentMetadata(Segment) {
      if (!Segment.SegmentLabel || !Segment.SegmentedPropertyCategoryCodeSequence || !Segment.SegmentedPropertyTypeCodeSequence || !Segment.SegmentAlgorithmType) {
        throw new Error("Segment does not contain all the required fields.");
      } // Capitalise the SegmentAlgorithmType if it happens to be given in
      // Lower/mixed case.


      Segment.SegmentAlgorithmType = Segment.SegmentAlgorithmType.toUpperCase(); // Check SegmentAlgorithmType and SegmentAlgorithmName if necessary.

      switch (Segment.SegmentAlgorithmType) {
        case "AUTOMATIC":
        case "SEMIAUTOMATIC":
          if (!Segment.SegmentAlgorithmName) {
            throw new Error("If the SegmentAlgorithmType is SEMIAUTOMATIC or AUTOMATIC,\n          SegmentAlgorithmName must be provided");
          }

          break;

        case "MANUAL":
          break;

        default:
          throw new Error("SegmentAlgorithmType ".concat(Segment.SegmentAlgorithmType, " invalid."));
      } // Deep copy, so we don't change the segment index stored in cornerstoneTools.


      var SegmentSequence = this.dataset.SegmentSequence;
      var SegmentAlgorithmType = Segment.SegmentAlgorithmType;
      var reNumberedSegmentCopy = {
        SegmentedPropertyCategoryCodeSequence: Segment.SegmentedPropertyCategoryCodeSequence,
        SegmentNumber: (SegmentSequence.length + 1).toString(),
        SegmentLabel: Segment.SegmentLabel,
        SegmentAlgorithmType: SegmentAlgorithmType,
        RecommendedDisplayCIELabValue: Segment.RecommendedDisplayCIELabValue,
        SegmentedPropertyTypeCodeSequence: Segment.SegmentedPropertyTypeCodeSequence
      };

      if (SegmentAlgorithmType === "AUTOMATIC" || SegmentAlgorithmType === "SEMIAUTOMATIC") {
        reNumberedSegmentCopy.SegmentAlgorithmName = Segment.SegmentAlgorithmName;
      }

      SegmentSequence.push(reNumberedSegmentCopy);
      return reNumberedSegmentCopy.SegmentNumber;
    }
  }]);

  return Segmentation;
}(DerivedPixels);

var ParametricMap = /*#__PURE__*/function (_DerivedDataset) {
  _inherits(ParametricMap, _DerivedDataset);

  var _super = _createSuper(ParametricMap);

  function ParametricMap(datasets) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, ParametricMap);

    return _super.call(this, datasets, options);
  } // this assumes a normalized multiframe input and will create
  // a multiframe derived image


  _createClass(ParametricMap, [{
    key: "derive",
    value: function derive() {
      _get(_getPrototypeOf(ParametricMap.prototype), "derive", this).call(this);

      this.assignToDataset({// TODO: ???
      });
      this.assignFromReference([]);
    }
  }]);

  return ParametricMap;
}(DerivedDataset);

var StructuredReport = /*#__PURE__*/function (_DerivedDataset) {
  _inherits(StructuredReport, _DerivedDataset);

  var _super = _createSuper(StructuredReport);

  function StructuredReport(datasets) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, StructuredReport);

    return _super.call(this, datasets, options);
  } // this assumes a normalized multiframe input and will create
  // a multiframe derived image


  _createClass(StructuredReport, [{
    key: "derive",
    value: function derive() {
      _get(_getPrototypeOf(StructuredReport.prototype), "derive", this).call(this);

      this.assignToDataset({
        SOPClassUID: DicomMetaDictionary.sopClassUIDsByName.EnhancedSR,
        Modality: "SR",
        ValueType: "CONTAINER"
      });
      this.assignFromReference([]);
    }
  }]);

  return StructuredReport;
}(DerivedDataset);

var TID1500MeasurementReport = /*#__PURE__*/function () {
  function TID1500MeasurementReport(TIDIncludeGroups) {
    _classCallCheck(this, TID1500MeasurementReport);

    this.TIDIncludeGroups = TIDIncludeGroups;
    var ImageLibraryContentSequence = [];
    var CurrentRequestedProcedureEvidenceSequence = [];
    this.ImageLibraryContentSequence = ImageLibraryContentSequence;
    this.CurrentRequestedProcedureEvidenceSequence = CurrentRequestedProcedureEvidenceSequence;
    this.PersonObserverName = {
      RelationshipType: "HAS OBS CONTEXT",
      ValueType: "PNAME",
      ConceptNameCodeSequence: {
        CodeValue: "121008",
        CodingSchemeDesignator: "DCM",
        CodeMeaning: "Person Observer Name"
      },
      PersonName: "unknown^unknown"
    };
    this.tid1500 = {
      ConceptNameCodeSequence: {
        CodeValue: "126000",
        CodingSchemeDesignator: "DCM",
        CodeMeaning: "Imaging Measurement Report"
      },
      ContinuityOfContent: "SEPARATE",
      PerformedProcedureCodeSequence: [],
      CompletionFlag: "COMPLETE",
      VerificationFlag: "UNVERIFIED",
      ReferencedPerformedProcedureStepSequence: [],
      InstanceNumber: 1,
      CurrentRequestedProcedureEvidenceSequence: CurrentRequestedProcedureEvidenceSequence,
      CodingSchemeIdentificationSequence: {
        CodingSchemeDesignator: "99dcmjs",
        CodingSchemeName: "Codes used for dcmjs",
        CodingSchemeVersion: "0",
        CodingSchemeResponsibleOrganization: "https://github.com/dcmjs-org/dcmjs"
      },
      ContentTemplateSequence: {
        MappingResource: "DCMR",
        TemplateIdentifier: "1500"
      },
      ContentSequence: [{
        RelationshipType: "HAS CONCEPT MOD",
        ValueType: "CODE",
        ConceptNameCodeSequence: addAccessors({
          CodeValue: "121049",
          CodingSchemeDesignator: "DCM",
          CodeMeaning: "Language of Content Item and Descendants"
        }),
        ConceptCodeSequence: addAccessors({
          CodeValue: "eng",
          CodingSchemeDesignator: "RFC5646",
          CodeMeaning: "English"
        }),
        ContentSequence: addAccessors({
          RelationshipType: "HAS CONCEPT MOD",
          ValueType: "CODE",
          ConceptNameCodeSequence: addAccessors({
            CodeValue: "121046",
            CodingSchemeDesignator: "DCM",
            CodeMeaning: "Country of Language"
          }),
          ConceptCodeSequence: addAccessors({
            CodeValue: "US",
            CodingSchemeDesignator: "ISO3166_1",
            CodeMeaning: "United States"
          })
        })
      }, this.PersonObserverName, {
        RelationshipType: "HAS CONCEPT MOD",
        ValueType: "CODE",
        ConceptNameCodeSequence: addAccessors({
          CodeValue: "121058",
          CodingSchemeDesignator: "DCM",
          CodeMeaning: "Procedure reported"
        }),
        ConceptCodeSequence: addAccessors({
          CodeValue: "1",
          CodingSchemeDesignator: "99dcmjs",
          CodeMeaning: "Unknown procedure"
        })
      }, {
        RelationshipType: "CONTAINS",
        ValueType: "CONTAINER",
        ConceptNameCodeSequence: {
          CodeValue: "111028",
          CodingSchemeDesignator: "DCM",
          CodeMeaning: "Image Library"
        },
        ContinuityOfContent: "SEPARATE",
        ContentSequence: {
          RelationshipType: "CONTAINS",
          ValueType: "CONTAINER",
          ConceptNameCodeSequence: {
            CodeValue: "126200",
            CodingSchemeDesignator: "DCM",
            CodeMeaning: "Image Library Group"
          },
          ContinuityOfContent: "SEPARATE",
          ContentSequence: ImageLibraryContentSequence
        }
      }]
    };
  }

  _createClass(TID1500MeasurementReport, [{
    key: "validate",
    value: function validate() {}
  }, {
    key: "contentItem",
    value: function contentItem(derivationSourceDatasetOrDatasets) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if (options.PersonName) {
        this.PersonObserverName.PersonName = options.PersonName;
      } // Note this is left in for compatibility with the Cornerstone Legacy adapter which only supports one series for now.


      var derivationSourceDatasets = Array.isArray(derivationSourceDatasetOrDatasets) ? derivationSourceDatasetOrDatasets : [derivationSourceDatasetOrDatasets]; // Add the Measurement Groups to the Measurement Report

      this.addTID1501MeasurementGroups(derivationSourceDatasets, options);
      return this.tid1500;
    }
  }, {
    key: "addTID1501MeasurementGroups",
    value: function addTID1501MeasurementGroups(derivationSourceDatasets) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var CurrentRequestedProcedureEvidenceSequence = this.CurrentRequestedProcedureEvidenceSequence,
          ImageLibraryContentSequence = this.ImageLibraryContentSequence;
      var sopInstanceUIDsToSeriesInstanceUIDMap = options.sopInstanceUIDsToSeriesInstanceUIDMap;

      if (derivationSourceDatasets.length > 1 && sopInstanceUIDsToSeriesInstanceUIDMap === undefined) {
        throw new Error("addTID1501MeasurementGroups provided with ".concat(derivationSourceDatasets.length, " derivationSourceDatasets, with no sopInstanceUIDsToSeriesInstanceUIDMap in options."));
      }

      var TID1501MeasurementGroups = this.TIDIncludeGroups.TID1501MeasurementGroups;

      if (!TID1501MeasurementGroups) {
        return;
      }

      var ContentSequence = [];
      TID1501MeasurementGroups.forEach(function (child) {
        ContentSequence = ContentSequence.concat(child.contentItem());
      });
      var parsedSOPInstances = []; // For each measurement that is referenced, add a link to the
      // Image Library Group and the Current Requested Procedure Evidence
      // with the proper ReferencedSOPSequence

      TID1501MeasurementGroups.forEach(function (measurementGroup) {
        measurementGroup.TID300Measurements.forEach(function (measurement) {
          var ReferencedSOPInstanceUID = measurement.ReferencedSOPSequence.ReferencedSOPInstanceUID;

          if (!parsedSOPInstances.includes(ReferencedSOPInstanceUID)) {
            ImageLibraryContentSequence.push({
              RelationshipType: "CONTAINS",
              ValueType: "IMAGE",
              ReferencedSOPSequence: measurement.ReferencedSOPSequence
            });
            var derivationSourceDataset;

            if (derivationSourceDatasets.length === 1) {
              // If there is only one derivationSourceDataset, use it.
              derivationSourceDataset = derivationSourceDatasets[0];
            } else {
              var SeriesInstanceUID = sopInstanceUIDsToSeriesInstanceUIDMap[ReferencedSOPInstanceUID];
              derivationSourceDataset = derivationSourceDatasets.find(function (dsd) {
                return dsd.SeriesInstanceUID === SeriesInstanceUID;
              });
            }
            /**
             * Note: the VM of the ReferencedSeriesSequence and ReferencedSOPSequence are 1, so
             * it is correct that we have a full `CurrentRequestedProcedureEvidenceSequence`
             * item per `SOPInstanceUID`.
             */


            CurrentRequestedProcedureEvidenceSequence.push({
              StudyInstanceUID: derivationSourceDataset.StudyInstanceUID,
              ReferencedSeriesSequence: {
                SeriesInstanceUID: derivationSourceDataset.SeriesInstanceUID,
                ReferencedSOPSequence: measurement.ReferencedSOPSequence
              }
            });
            parsedSOPInstances.push(ReferencedSOPInstanceUID);
          }
        });
      });
      var ImagingMeasurments = {
        RelationshipType: "CONTAINS",
        ValueType: "CONTAINER",
        ConceptNameCodeSequence: {
          CodeValue: "126010",
          CodingSchemeDesignator: "DCM",
          CodeMeaning: "Imaging Measurements" // TODO: would be nice to abstract the code sequences (in a dictionary? a service?)

        },
        ContinuityOfContent: "SEPARATE",
        ContentSequence: ContentSequence
      };
      this.tid1500.ContentSequence.push(ImagingMeasurments);
    }
  }]);

  return TID1500MeasurementReport;
}();

var TID1501MeasurementGroup = /*#__PURE__*/function () {
  function TID1501MeasurementGroup(TID300Measurements) {
    _classCallCheck(this, TID1501MeasurementGroup);

    this.TID300Measurements = TID300Measurements;
  }

  _createClass(TID1501MeasurementGroup, [{
    key: "contentItem",
    value: function contentItem() {
      var _this = this;

      var TID300Measurements = this.TID300Measurements; // TODO: Is there nothing else in this group?

      var measurementGroups = [];
      TID300Measurements.forEach(function (TID300Measurement) {
        measurementGroups.push(_this.getMeasurementGroup(TID300Measurement.contentItem()));
      });
      return measurementGroups;
    }
  }, {
    key: "getMeasurementGroup",
    value: function getMeasurementGroup(contentSequenceEntries) {
      return {
        RelationshipType: "CONTAINS",
        ValueType: "CONTAINER",
        ConceptNameCodeSequence: {
          CodeValue: "125007",
          CodingSchemeDesignator: "DCM",
          CodeMeaning: "Measurement Group"
        },
        ContinuityOfContent: "SEPARATE",
        ContentSequence: _toConsumableArray(contentSequenceEntries)
      };
    }
  }]);

  return TID1501MeasurementGroup;
}();

var toArray = function toArray(x) {
  return Array.isArray(x) ? x : [x];
};

var codeMeaningEquals = function codeMeaningEquals(codeMeaningName) {
  return function (contentItem) {
    return contentItem.ConceptNameCodeSequence.CodeMeaning === codeMeaningName;
  };
};

var graphicTypeEquals = function graphicTypeEquals(graphicType) {
  return function (contentItem) {
    return contentItem && contentItem.GraphicType === graphicType;
  };
};

var FINDING$2 = {
  CodingSchemeDesignator: "DCM",
  CodeValue: "121071"
};
var FINDING_SITE$2 = {
  CodingSchemeDesignator: "SCT",
  CodeValue: "363698007"
};
var FINDING_SITE_OLD$1 = {
  CodingSchemeDesignator: "SRT",
  CodeValue: "G-C0E3"
};

var codeValueMatch$1 = function codeValueMatch(group, code, oldCode) {
  var ConceptNameCodeSequence = group.ConceptNameCodeSequence;
  if (!ConceptNameCodeSequence) return;
  var CodingSchemeDesignator = ConceptNameCodeSequence.CodingSchemeDesignator,
      CodeValue = ConceptNameCodeSequence.CodeValue;
  return CodingSchemeDesignator == code.CodingSchemeDesignator && CodeValue == code.CodeValue || oldCode && CodingSchemeDesignator == oldCode.CodingSchemeDesignator && CodeValue == oldCode.CodeValue;
};

function getTID300ContentItem$2(tool, toolType, ReferencedSOPSequence, toolClass) {
  var args = toolClass.getTID300RepresentationArguments(tool);
  args.ReferencedSOPSequence = ReferencedSOPSequence;
  var TID300Measurement = new toolClass.TID300Representation(args);
  return TID300Measurement;
}

function getMeasurementGroup$2(toolType, toolData, ReferencedSOPSequence) {
  var toolTypeData = toolData[toolType];
  var toolClass = MeasurementReport$3.CORNERSTONE_TOOL_CLASSES_BY_TOOL_TYPE[toolType];

  if (!toolTypeData || !toolTypeData.data || !toolTypeData.data.length || !toolClass) {
    return;
  } // Loop through the array of tool instances
  // for this tool


  var Measurements = toolTypeData.data.map(function (tool) {
    return getTID300ContentItem$2(tool, toolType, ReferencedSOPSequence, toolClass);
  });
  return new TID1501MeasurementGroup(Measurements);
}

var MeasurementReport$3 = /*#__PURE__*/function () {
  function MeasurementReport() {
    _classCallCheck(this, MeasurementReport);
  }

  _createClass(MeasurementReport, null, [{
    key: "getSetupMeasurementData",
    value: function getSetupMeasurementData(MeasurementGroup) {
      var ContentSequence = MeasurementGroup.ContentSequence;
      var contentSequenceArr = toArray(ContentSequence);
      var findingGroup = contentSequenceArr.find(function (group) {
        return codeValueMatch$1(group, FINDING$2);
      });
      var findingSiteGroups = contentSequenceArr.filter(function (group) {
        return codeValueMatch$1(group, FINDING_SITE$2, FINDING_SITE_OLD$1);
      }) || [];
      var NUMGroup = contentSequenceArr.find(function (group) {
        return group.ValueType === "NUM";
      });
      var SCOORDGroup = toArray(NUMGroup.ContentSequence).find(function (group) {
        return group.ValueType === "SCOORD";
      });
      var ReferencedSOPSequence = SCOORDGroup.ContentSequence.ReferencedSOPSequence;
      var ReferencedSOPInstanceUID = ReferencedSOPSequence.ReferencedSOPInstanceUID,
          ReferencedFrameNumber = ReferencedSOPSequence.ReferencedFrameNumber;
      var defaultState = {
        sopInstanceUid: ReferencedSOPInstanceUID,
        frameIndex: ReferencedFrameNumber || 1,
        complete: true,
        finding: findingGroup ? addAccessors(findingGroup.ConceptCodeSequence) : undefined,
        findingSites: findingSiteGroups.map(function (fsg) {
          return addAccessors(fsg.ConceptCodeSequence);
        })
      };

      if (defaultState.finding) {
        defaultState.description = defaultState.finding.CodeMeaning;
      }

      var findingSite = defaultState.findingSites && defaultState.findingSites[0];

      if (findingSite) {
        defaultState.location = findingSite[0] && findingSite[0].CodeMeaning || findingSite.CodeMeaning;
      }

      return {
        defaultState: defaultState,
        findingGroup: findingGroup,
        findingSiteGroups: findingSiteGroups,
        NUMGroup: NUMGroup,
        SCOORDGroup: SCOORDGroup,
        ReferencedSOPSequence: ReferencedSOPSequence,
        ReferencedSOPInstanceUID: ReferencedSOPInstanceUID,
        ReferencedFrameNumber: ReferencedFrameNumber
      };
    }
  }, {
    key: "generateReport",
    value: function generateReport(toolState, metadataProvider, options) {
      // ToolState for array of imageIDs to a Report
      // Assume Cornerstone metadata provider has access to Study / Series / Sop Instance UID
      var allMeasurementGroups = [];
      var firstImageId = Object.keys(toolState)[0];

      if (!firstImageId) {
        throw new Error("No measurements provided.");
      }
      /* Patient ID
      Warning - Missing attribute or value that would be needed to build DICOMDIR - Patient ID
      Warning - Missing attribute or value that would be needed to build DICOMDIR - Study Date
      Warning - Missing attribute or value that would be needed to build DICOMDIR - Study Time
      Warning - Missing attribute or value that would be needed to build DICOMDIR - Study ID
       */


      var generalSeriesModule = metadataProvider.get("generalSeriesModule", firstImageId); //const sopCommonModule = metadataProvider.get('sopCommonModule', firstImageId);
      // NOTE: We are getting the Series and Study UIDs from the first imageId of the toolState
      // which means that if the toolState is for multiple series, the report will have the incorrect
      // SeriesInstanceUIDs

      var studyInstanceUID = generalSeriesModule.studyInstanceUID,
          seriesInstanceUID = generalSeriesModule.seriesInstanceUID; // Loop through each image in the toolData

      Object.keys(toolState).forEach(function (imageId) {
        var sopCommonModule = metadataProvider.get("sopCommonModule", imageId);
        var frameNumber = metadataProvider.get("frameNumber", imageId);
        var toolData = toolState[imageId];
        var toolTypes = Object.keys(toolData);
        var ReferencedSOPSequence = {
          ReferencedSOPClassUID: sopCommonModule.sopClassUID,
          ReferencedSOPInstanceUID: sopCommonModule.sopInstanceUID
        };

        if (Normalizer.isMultiframeSOPClassUID(sopCommonModule.sopClassUID)) {
          ReferencedSOPSequence.ReferencedFrameNumber = frameNumber;
        } // Loop through each tool type for the image


        var measurementGroups = [];
        toolTypes.forEach(function (toolType) {
          var group = getMeasurementGroup$2(toolType, toolData, ReferencedSOPSequence);

          if (group) {
            measurementGroups.push(group);
          }
        });
        allMeasurementGroups = allMeasurementGroups.concat(measurementGroups);
      });

      var _MeasurementReport = new TID1500MeasurementReport({
        TID1501MeasurementGroups: allMeasurementGroups
      }, options); // TODO: what is the correct metaheader
      // http://dicom.nema.org/medical/Dicom/current/output/chtml/part10/chapter_7.html
      // TODO: move meta creation to happen in derivations.js


      var fileMetaInformationVersionArray = new Uint8Array(2);
      fileMetaInformationVersionArray[1] = 1;
      var derivationSourceDataset = {
        StudyInstanceUID: studyInstanceUID,
        SeriesInstanceUID: seriesInstanceUID //SOPInstanceUID: sopInstanceUID, // TODO: Necessary?
        //SOPClassUID: sopClassUID,

      };
      var _meta = {
        FileMetaInformationVersion: {
          Value: [fileMetaInformationVersionArray.buffer],
          vr: "OB"
        },
        //MediaStorageSOPClassUID
        //MediaStorageSOPInstanceUID: sopCommonModule.sopInstanceUID,
        TransferSyntaxUID: {
          Value: ["1.2.840.10008.1.2.1"],
          vr: "UI"
        },
        ImplementationClassUID: {
          Value: [DicomMetaDictionary.uid()],
          // TODO: could be git hash or other valid id
          vr: "UI"
        },
        ImplementationVersionName: {
          Value: ["dcmjs"],
          vr: "SH"
        }
      };
      var _vrMap = {
        PixelData: "OW"
      };
      derivationSourceDataset._meta = _meta;
      derivationSourceDataset._vrMap = _vrMap;
      var report = new StructuredReport([derivationSourceDataset]);

      var contentItem = _MeasurementReport.contentItem(derivationSourceDataset); // Merge the derived dataset with the content from the Measurement Report


      report.dataset = Object.assign(report.dataset, contentItem);
      report.dataset._meta = _meta;
      return report;
    }
    /**
     * Generate Cornerstone tool state from dataset
     * @param {object} dataset dataset
     * @param {object} hooks
     * @param {function} hooks.getToolClass Function to map dataset to a tool class
     * @returns
     */

  }, {
    key: "generateToolState",
    value: function generateToolState(dataset) {
      var hooks = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      // For now, bail out if the dataset is not a TID1500 SR with length measurements
      if (dataset.ContentTemplateSequence.TemplateIdentifier !== "1500") {
        throw new Error("This package can currently only interpret DICOM SR TID 1500");
      }

      var REPORT = "Imaging Measurements";
      var GROUP = "Measurement Group";
      var TRACKING_IDENTIFIER = "Tracking Identifier"; // Identify the Imaging Measurements

      var imagingMeasurementContent = toArray(dataset.ContentSequence).find(codeMeaningEquals(REPORT)); // Retrieve the Measurements themselves

      var measurementGroups = toArray(imagingMeasurementContent.ContentSequence).filter(codeMeaningEquals(GROUP)); // For each of the supported measurement types, compute the measurement data

      var measurementData = {};
      var cornerstoneToolClasses = MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_UTILITY_TYPE;
      var registeredToolClasses = [];
      Object.keys(cornerstoneToolClasses).forEach(function (key) {
        registeredToolClasses.push(cornerstoneToolClasses[key]);
        measurementData[key] = [];
      });
      measurementGroups.forEach(function (measurementGroup) {
        var measurementGroupContentSequence = toArray(measurementGroup.ContentSequence);
        var TrackingIdentifierGroup = measurementGroupContentSequence.find(function (contentItem) {
          return contentItem.ConceptNameCodeSequence.CodeMeaning === TRACKING_IDENTIFIER;
        });
        var TrackingIdentifierValue = TrackingIdentifierGroup.TextValue;
        var toolClass = hooks.getToolClass ? hooks.getToolClass(measurementGroup, dataset, registeredToolClasses) : registeredToolClasses.find(function (tc) {
          return tc.isValidCornerstoneTrackingIdentifier(TrackingIdentifierValue);
        });

        if (toolClass) {
          var measurement = toolClass.getMeasurementData(measurementGroup);
          console.log("=== ".concat(toolClass.toolType, " ==="));
          console.log(measurement);
          measurementData[toolClass.toolType].push(measurement);
        }
      }); // NOTE: There is no way of knowing the cornerstone imageIds as that could be anything.
      // That is up to the consumer to derive from the SOPInstanceUIDs.

      return measurementData;
    }
  }, {
    key: "registerTool",
    value: function registerTool(toolClass) {
      MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_UTILITY_TYPE[toolClass.utilityToolType] = toolClass;
      MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_TOOL_TYPE[toolClass.toolType] = toolClass;
      MeasurementReport.MEASUREMENT_BY_TOOLTYPE[toolClass.toolType] = toolClass.utilityToolType;
    }
  }]);

  return MeasurementReport;
}();
MeasurementReport$3.MEASUREMENT_BY_TOOLTYPE = {};
MeasurementReport$3.CORNERSTONE_TOOL_CLASSES_BY_UTILITY_TYPE = {};
MeasurementReport$3.CORNERSTONE_TOOL_CLASSES_BY_TOOL_TYPE = {};

var TID300Measurement = /*#__PURE__*/function () {
  function TID300Measurement(props) {
    _classCallCheck(this, TID300Measurement);

    this.ReferencedSOPSequence = props.ReferencedSOPSequence;
    this.props = props;
  }

  _createClass(TID300Measurement, [{
    key: "getMeasurement",
    value: function getMeasurement(contentSequenceEntries) {
      return [].concat(_toConsumableArray(this.getTrackingGroups()), _toConsumableArray(this.getFindingGroup()), _toConsumableArray(this.getFindingSiteGroups()), _toConsumableArray(contentSequenceEntries));
    }
  }, {
    key: "getTrackingGroups",
    value: function getTrackingGroups() {
      var trackingIdentifierTextValue = this.props.trackingIdentifierTextValue;
      return [{
        RelationshipType: "HAS OBS CONTEXT",
        ValueType: "TEXT",
        ConceptNameCodeSequence: {
          CodeValue: "112039",
          CodingSchemeDesignator: "DCM",
          CodeMeaning: "Tracking Identifier"
        },
        TextValue: trackingIdentifierTextValue || "web annotation"
      }, {
        RelationshipType: "HAS OBS CONTEXT",
        ValueType: "UIDREF",
        ConceptNameCodeSequence: {
          CodeValue: "112040",
          CodingSchemeDesignator: "DCM",
          CodeMeaning: "Tracking Unique Identifier"
        },
        UID: DicomMetaDictionary.uid()
      }];
    }
  }, {
    key: "getFindingGroup",
    value: function getFindingGroup() {
      var finding = this.props.finding;

      if (!finding) {
        return [];
      }

      var CodeValue = finding.CodeValue,
          CodingSchemeDesignator = finding.CodingSchemeDesignator,
          CodeMeaning = finding.CodeMeaning;
      return [{
        RelationshipType: "CONTAINS",
        ValueType: "CODE",
        ConceptNameCodeSequence: addAccessors({
          CodeValue: "121071",
          CodingSchemeDesignator: "DCM",
          CodeMeaning: "Finding"
        }),
        ConceptCodeSequence: addAccessors({
          CodeValue: CodeValue,
          //: "SAMPLE FINDING",
          CodingSchemeDesignator: CodingSchemeDesignator,
          //: "99dcmjs",
          CodeMeaning: CodeMeaning //: "Sample Finding"

        })
      }];
    }
  }, {
    key: "getFindingSiteGroups",
    value: function getFindingSiteGroups() {
      var findingSites = this.props.findingSites || [];
      return findingSites.map(function (findingSite) {
        var CodeValue = findingSite.CodeValue,
            CodingSchemeDesignator = findingSite.CodingSchemeDesignator,
            CodeMeaning = findingSite.CodeMeaning;
        return {
          RelationshipType: "CONTAINS",
          ValueType: "CODE",
          ConceptNameCodeSequence: addAccessors({
            CodeValue: "363698007",
            CodingSchemeDesignator: "SCT",
            CodeMeaning: "Finding Site"
          }),
          ConceptCodeSequence: addAccessors({
            CodeValue: CodeValue,
            //: "SAMPLE FINDING SITE",
            CodingSchemeDesignator: CodingSchemeDesignator,
            //: "99dcmjs",
            CodeMeaning: CodeMeaning //: "Sample Finding Site"

          })
        };
      });
    }
  }]);

  return TID300Measurement;
}();

var MM_UNIT = {
  CodeValue: "mm",
  CodingSchemeDesignator: "UCUM",
  CodingSchemeVersion: "1.4",
  CodeMeaning: "millimeter"
};
var MM2_UNIT = {
  CodeValue: "mm2",
  CodingSchemeDesignator: "UCUM",
  CodingSchemeVersion: "1.4",
  CodeMeaning: "SquareMilliMeter"
};
var NO_UNIT = {
  CodeValue: "1",
  CodingSchemeDesignator: "UCUM",
  CodingSchemeVersion: "1.4",
  CodeMeaning: "px"
};
var NO2_UNIT = NO_UNIT;
var measurementMap = {
  px: NO_UNIT,
  mm: MM_UNIT,
  mm2: MM2_UNIT,
  "mm\xB2": MM2_UNIT,
  "px\xB2": NO2_UNIT
};
/** Converts the given unit into the
 * specified coding values.
 * Has .measurementMap on the function specifying global units for measurements.
 */

var unit2CodingValue = function unit2CodingValue(units) {
  if (!units) return NO_UNIT;
  var space = units.indexOf(" ");
  var baseUnit = space === -1 ? units : units.substring(0, space);
  var codingUnit = measurementMap[units] || measurementMap[baseUnit];

  if (!codingUnit) {
    log.error("Unspecified units", units);
    return MM_UNIT;
  }

  return codingUnit;
};

unit2CodingValue.measurementMap = measurementMap;

var Length$2 = /*#__PURE__*/function (_TID300Measurement) {
  _inherits(Length, _TID300Measurement);

  var _super = _createSuper(Length);

  function Length() {
    _classCallCheck(this, Length);

    return _super.apply(this, arguments);
  }

  _createClass(Length, [{
    key: "contentItem",
    value: function contentItem() {
      var _this$props = this.props,
          point1 = _this$props.point1,
          point2 = _this$props.point2,
          _this$props$unit = _this$props.unit,
          unit = _this$props$unit === void 0 ? "mm" : _this$props$unit,
          distance = _this$props.distance,
          ReferencedSOPSequence = _this$props.ReferencedSOPSequence;
      return this.getMeasurement([{
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "G-D7FE",
          CodingSchemeDesignator: "SRT",
          CodeMeaning: "Length"
        },
        MeasuredValueSequence: {
          MeasurementUnitsCodeSequence: unit2CodingValue(unit),
          NumericValue: distance
        },
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: "SCOORD",
          GraphicType: "POLYLINE",
          GraphicData: [point1.x, point1.y, point2.x, point2.y],
          ContentSequence: {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }]);
    }
  }]);

  return Length;
}(TID300Measurement);

var CORNERSTONE_4_TAG = "cornerstoneTools@^4.0.0";

var LENGTH$1 = "Length";

var Length$1 = /*#__PURE__*/function () {
  function Length() {
    _classCallCheck(this, Length);
  } // TODO: this function is required for all Cornerstone Tool Adapters, since it is called by MeasurementReport.


  _createClass(Length, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup) {
      var _MeasurementReport$ge = MeasurementReport$3.getSetupMeasurementData(MeasurementGroup),
          defaultState = _MeasurementReport$ge.defaultState,
          NUMGroup = _MeasurementReport$ge.NUMGroup,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup;

      var state = _objectSpread2(_objectSpread2({}, defaultState), {}, {
        length: NUMGroup.MeasuredValueSequence.NumericValue,
        toolType: Length.toolType,
        handles: {
          start: {},
          end: {},
          textBox: {
            hasMoved: false,
            movesIndependently: false,
            drawnIndependently: true,
            allowedOutsideImage: true,
            hasBoundingBox: true
          }
        }
      });

      var _SCOORDGroup$GraphicD = _slicedToArray(SCOORDGroup.GraphicData, 4);

      state.handles.start.x = _SCOORDGroup$GraphicD[0];
      state.handles.start.y = _SCOORDGroup$GraphicD[1];
      state.handles.end.x = _SCOORDGroup$GraphicD[2];
      state.handles.end.y = _SCOORDGroup$GraphicD[3];
      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool) {
      var handles = tool.handles,
          finding = tool.finding,
          findingSites = tool.findingSites;
      var point1 = handles.start;
      var point2 = handles.end;
      var distance = tool.length;
      var trackingIdentifierTextValue = "cornerstoneTools@^4.0.0:Length";
      return {
        point1: point1,
        point2: point2,
        distance: distance,
        trackingIdentifierTextValue: trackingIdentifierTextValue,
        finding: finding,
        findingSites: findingSites || []
      };
    }
  }]);

  return Length;
}();

Length$1.toolType = LENGTH$1;
Length$1.utilityToolType = LENGTH$1;
Length$1.TID300Representation = Length$2;

Length$1.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone4Tag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone4Tag !== CORNERSTONE_4_TAG) {
    return false;
  }

  return toolType === LENGTH$1;
};

MeasurementReport$3.registerTool(Length$1);

/**
 * Expand an array of points stored as objects into
 * a flattened array of points
 *
 * @param points [{x: 0, y: 1}, {x: 1, y: 2}] or [{x: 0, y: 1, z: 0}, {x: 1, y: 2, z: 0}]
 * @return {Array} [point1x, point1y, point2x, point2y] or [point1x, point1y, point1z, point2x, point2y, point2z]
 */

function expandPoints$3(points) {
  var allPoints = [];
  points.forEach(function (point) {
    allPoints.push(point[0] || point.x);
    allPoints.push(point[1] || point.y);

    if (point[2] !== undefined || point.z !== undefined) {
      allPoints.push(point[2] || point.z);
    }
  });
  return allPoints;
}

var Polyline$1 = /*#__PURE__*/function (_TID300Measurement) {
  _inherits(Polyline, _TID300Measurement);

  var _super = _createSuper(Polyline);

  function Polyline() {
    _classCallCheck(this, Polyline);

    return _super.apply(this, arguments);
  }

  _createClass(Polyline, [{
    key: "contentItem",
    value: function contentItem() {
      var _this$props = this.props,
          points = _this$props.points,
          area = _this$props.area,
          _this$props$areaUnit = _this$props.areaUnit,
          areaUnit = _this$props$areaUnit === void 0 ? "mm2" : _this$props$areaUnit,
          ReferencedSOPSequence = _this$props.ReferencedSOPSequence,
          _this$props$use3DSpat = _this$props.use3DSpatialCoordinates,
          use3DSpatialCoordinates = _this$props$use3DSpat === void 0 ? false : _this$props$use3DSpat,
          perimeter = _this$props.perimeter,
          _this$props$unit = _this$props.unit,
          unit = _this$props$unit === void 0 ? "mm" : _this$props$unit;
      var GraphicData = expandPoints$3(points); // TODO: Add Mean and STDev value of (modality?) pixels

      return this.getMeasurement([{
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "131191004",
          CodingSchemeDesignator: "SCT",
          CodeMeaning: "Perimeter"
        },
        MeasuredValueSequence: {
          MeasurementUnitsCodeSequence: unit2CodingValue(unit),
          NumericValue: perimeter
        },
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: use3DSpatialCoordinates ? "SCOORD3D" : "SCOORD",
          GraphicType: "POLYLINE",
          GraphicData: GraphicData,
          ContentSequence: use3DSpatialCoordinates ? undefined : {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }, {
        // TODO: This feels weird to repeat the GraphicData
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "G-A166",
          CodingSchemeDesignator: "SRT",
          CodeMeaning: "Area" // TODO: Look this up from a Code Meaning dictionary

        },
        MeasuredValueSequence: {
          MeasurementUnitsCodeSequence: unit2CodingValue(areaUnit),
          NumericValue: area
        },
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: use3DSpatialCoordinates ? "SCOORD3D" : "SCOORD",
          GraphicType: "POLYLINE",
          GraphicData: GraphicData,
          ContentSequence: use3DSpatialCoordinates ? undefined : {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }]);
    }
  }]);

  return Polyline;
}(TID300Measurement);

var FreehandRoi = /*#__PURE__*/function () {
  function FreehandRoi() {
    _classCallCheck(this, FreehandRoi);
  }

  _createClass(FreehandRoi, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup) {
      var _MeasurementReport$ge = MeasurementReport$3.getSetupMeasurementData(MeasurementGroup),
          defaultState = _MeasurementReport$ge.defaultState,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup,
          NUMGroup = _MeasurementReport$ge.NUMGroup;

      var state = _objectSpread2(_objectSpread2({}, defaultState), {}, {
        toolType: FreehandRoi.toolType,
        handles: {
          points: [],
          textBox: {
            active: false,
            hasMoved: false,
            movesIndependently: false,
            drawnIndependently: true,
            allowedOutsideImage: true,
            hasBoundingBox: true
          }
        },
        cachedStats: {
          area: NUMGroup ? NUMGroup.MeasuredValueSequence.NumericValue : 0
        },
        color: undefined,
        invalidated: true
      });

      var GraphicData = SCOORDGroup.GraphicData;

      for (var i = 0; i < GraphicData.length; i += 2) {
        state.handles.points.push({
          x: GraphicData[i],
          y: GraphicData[i + 1]
        });
      }

      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool) {
      var handles = tool.handles,
          finding = tool.finding,
          findingSites = tool.findingSites,
          _tool$cachedStats = tool.cachedStats,
          cachedStats = _tool$cachedStats === void 0 ? {} : _tool$cachedStats;
      var points = handles.points;
      var _cachedStats$area = cachedStats.area,
          area = _cachedStats$area === void 0 ? 0 : _cachedStats$area,
          _cachedStats$perimete = cachedStats.perimeter,
          perimeter = _cachedStats$perimete === void 0 ? 0 : _cachedStats$perimete;
      var trackingIdentifierTextValue = "cornerstoneTools@^4.0.0:FreehandRoi";
      return {
        points: points,
        area: area,
        perimeter: perimeter,
        trackingIdentifierTextValue: trackingIdentifierTextValue,
        finding: finding,
        findingSites: findingSites || []
      };
    }
  }]);

  return FreehandRoi;
}();

FreehandRoi.toolType = "FreehandRoi";
FreehandRoi.utilityToolType = "FreehandRoi";
FreehandRoi.TID300Representation = Polyline$1;

FreehandRoi.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone4Tag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone4Tag !== CORNERSTONE_4_TAG) {
    return false;
  }

  return toolType === FreehandRoi.toolType;
};

MeasurementReport$3.registerTool(FreehandRoi);

var Bidirectional$2 = /*#__PURE__*/function (_TID300Measurement) {
  _inherits(Bidirectional, _TID300Measurement);

  var _super = _createSuper(Bidirectional);

  function Bidirectional() {
    _classCallCheck(this, Bidirectional);

    return _super.apply(this, arguments);
  }

  _createClass(Bidirectional, [{
    key: "contentItem",
    value: function contentItem() {
      var _this$props = this.props,
          longAxis = _this$props.longAxis,
          shortAxis = _this$props.shortAxis,
          longAxisLength = _this$props.longAxisLength,
          shortAxisLength = _this$props.shortAxisLength,
          unit = _this$props.unit,
          ReferencedSOPSequence = _this$props.ReferencedSOPSequence;
      return this.getMeasurement([{
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "G-A185",
          CodingSchemeDesignator: "SRT",
          CodeMeaning: "Long Axis"
        },
        MeasuredValueSequence: {
          MeasurementUnitsCodeSequence: unit2CodingValue(unit),
          NumericValue: longAxisLength
        },
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: "SCOORD",
          GraphicType: "POLYLINE",
          GraphicData: [longAxis.point1.x, longAxis.point1.y, longAxis.point2.x, longAxis.point2.y],
          ContentSequence: {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }, {
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "G-A186",
          CodingSchemeDesignator: "SRT",
          CodeMeaning: "Short Axis"
        },
        MeasuredValueSequence: {
          MeasurementUnitsCodeSequence: unit2CodingValue(unit),
          NumericValue: shortAxisLength
        },
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: "SCOORD",
          GraphicType: "POLYLINE",
          GraphicData: [shortAxis.point1.x, shortAxis.point1.y, shortAxis.point2.x, shortAxis.point2.y],
          ContentSequence: {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }]);
    }
  }]);

  return Bidirectional;
}(TID300Measurement);

var BIDIRECTIONAL$1 = "Bidirectional";
var LONG_AXIS$1 = "Long Axis";
var SHORT_AXIS$1 = "Short Axis";
var FINDING$1 = "121071";
var FINDING_SITE$1 = "G-C0E3";

var Bidirectional$1 = /*#__PURE__*/function () {
  function Bidirectional() {
    _classCallCheck(this, Bidirectional);
  } // TODO: this function is required for all Cornerstone Tool Adapters, since it is called by MeasurementReport.


  _createClass(Bidirectional, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup) {
      var _state;

      var ContentSequence = MeasurementGroup.ContentSequence;
      var findingGroup = toArray(ContentSequence).find(function (group) {
        return group.ConceptNameCodeSequence.CodeValue === FINDING$1;
      });
      var findingSiteGroups = toArray(ContentSequence).filter(function (group) {
        return group.ConceptNameCodeSequence.CodeValue === FINDING_SITE$1;
      });
      var longAxisNUMGroup = toArray(ContentSequence).find(function (group) {
        return group.ConceptNameCodeSequence.CodeMeaning === LONG_AXIS$1;
      });
      var longAxisSCOORDGroup = toArray(longAxisNUMGroup.ContentSequence).find(function (group) {
        return group.ValueType === "SCOORD";
      });
      var shortAxisNUMGroup = toArray(ContentSequence).find(function (group) {
        return group.ConceptNameCodeSequence.CodeMeaning === SHORT_AXIS$1;
      });
      var shortAxisSCOORDGroup = toArray(shortAxisNUMGroup.ContentSequence).find(function (group) {
        return group.ValueType === "SCOORD";
      });
      var ReferencedSOPSequence = longAxisSCOORDGroup.ContentSequence.ReferencedSOPSequence;
      var ReferencedSOPInstanceUID = ReferencedSOPSequence.ReferencedSOPInstanceUID,
          ReferencedFrameNumber = ReferencedSOPSequence.ReferencedFrameNumber; // Long axis

      var longestDiameter = String(longAxisNUMGroup.MeasuredValueSequence.NumericValue);
      var shortestDiameter = String(shortAxisNUMGroup.MeasuredValueSequence.NumericValue);
      var bottomRight = {
        x: Math.max(longAxisSCOORDGroup.GraphicData[0], longAxisSCOORDGroup.GraphicData[2], shortAxisSCOORDGroup.GraphicData[0], shortAxisSCOORDGroup.GraphicData[2]),
        y: Math.max(longAxisSCOORDGroup.GraphicData[1], longAxisSCOORDGroup.GraphicData[3], shortAxisSCOORDGroup.GraphicData[1], shortAxisSCOORDGroup.GraphicData[3])
      };
      var state = (_state = {
        sopInstanceUid: ReferencedSOPInstanceUID,
        frameIndex: ReferencedFrameNumber || 1,
        toolType: Bidirectional.toolType,
        active: false,
        handles: {
          start: {
            x: longAxisSCOORDGroup.GraphicData[0],
            y: longAxisSCOORDGroup.GraphicData[1],
            drawnIndependently: false,
            allowedOutsideImage: false,
            active: false,
            highlight: false,
            index: 0
          },
          end: {
            x: longAxisSCOORDGroup.GraphicData[2],
            y: longAxisSCOORDGroup.GraphicData[3],
            drawnIndependently: false,
            allowedOutsideImage: false,
            active: false,
            highlight: false,
            index: 1
          },
          perpendicularStart: {
            x: shortAxisSCOORDGroup.GraphicData[0],
            y: shortAxisSCOORDGroup.GraphicData[1],
            drawnIndependently: false,
            allowedOutsideImage: false,
            active: false,
            highlight: false,
            index: 2
          },
          perpendicularEnd: {
            x: shortAxisSCOORDGroup.GraphicData[2],
            y: shortAxisSCOORDGroup.GraphicData[3],
            drawnIndependently: false,
            allowedOutsideImage: false,
            active: false,
            highlight: false,
            index: 3
          },
          textBox: {
            highlight: false,
            hasMoved: true,
            active: false,
            movesIndependently: false,
            drawnIndependently: true,
            allowedOutsideImage: true,
            hasBoundingBox: true,
            x: bottomRight.x + 10,
            y: bottomRight.y + 10
          }
        },
        invalidated: false,
        isCreating: false,
        longestDiameter: longestDiameter,
        shortestDiameter: shortestDiameter
      }, _defineProperty(_state, "toolType", "Bidirectional"), _defineProperty(_state, "toolName", "Bidirectional"), _defineProperty(_state, "visible", true), _defineProperty(_state, "finding", findingGroup ? findingGroup.ConceptCodeSequence : undefined), _defineProperty(_state, "findingSites", findingSiteGroups.map(function (fsg) {
        return fsg.ConceptCodeSequence;
      })), _state);
      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool) {
      var _tool$handles = tool.handles,
          start = _tool$handles.start,
          end = _tool$handles.end,
          perpendicularStart = _tool$handles.perpendicularStart,
          perpendicularEnd = _tool$handles.perpendicularEnd;
      var shortestDiameter = tool.shortestDiameter,
          longestDiameter = tool.longestDiameter,
          finding = tool.finding,
          findingSites = tool.findingSites;
      var trackingIdentifierTextValue = "cornerstoneTools@^4.0.0:Bidirectional";
      return {
        longAxis: {
          point1: start,
          point2: end
        },
        shortAxis: {
          point1: perpendicularStart,
          point2: perpendicularEnd
        },
        longAxisLength: longestDiameter,
        shortAxisLength: shortestDiameter,
        trackingIdentifierTextValue: trackingIdentifierTextValue,
        finding: finding,
        findingSites: findingSites || []
      };
    }
  }]);

  return Bidirectional;
}();

Bidirectional$1.toolType = BIDIRECTIONAL$1;
Bidirectional$1.utilityToolType = BIDIRECTIONAL$1;
Bidirectional$1.TID300Representation = Bidirectional$2;

Bidirectional$1.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone4Tag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone4Tag !== CORNERSTONE_4_TAG) {
    return false;
  }

  return toolType === BIDIRECTIONAL$1;
};

MeasurementReport$3.registerTool(Bidirectional$1);

/**
 * Expand an array of points stored as objects into
 * a flattened array of points
 *
 * @param points
 * @return {Array}
 */

function expandPoints$2(points) {
  var allPoints = [];
  points.forEach(function (point) {
    allPoints.push(point.x);
    allPoints.push(point.y);
  });
  return allPoints;
}

var Ellipse$1 = /*#__PURE__*/function (_TID300Measurement) {
  _inherits(Ellipse, _TID300Measurement);

  var _super = _createSuper(Ellipse);

  function Ellipse() {
    _classCallCheck(this, Ellipse);

    return _super.apply(this, arguments);
  }

  _createClass(Ellipse, [{
    key: "contentItem",
    value: function contentItem() {
      var _this$props = this.props,
          points = _this$props.points,
          ReferencedSOPSequence = _this$props.ReferencedSOPSequence,
          area = _this$props.area,
          areaUnit = _this$props.areaUnit;
      var GraphicData = expandPoints$2(points);
      return this.getMeasurement([{
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "G-D7FE",
          CodingSchemeDesignator: "SRT",
          CodeMeaning: "AREA"
        },
        MeasuredValueSequence: {
          MeasurementUnitsCodeSequence: unit2CodingValue(areaUnit),
          NumericValue: area
        },
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: "SCOORD",
          GraphicType: "ELLIPSE",
          GraphicData: GraphicData,
          ContentSequence: {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }]);
    }
  }]);

  return Ellipse;
}(TID300Measurement);

var ELLIPTICALROI$1 = "EllipticalRoi";

var EllipticalRoi = /*#__PURE__*/function () {
  function EllipticalRoi() {
    _classCallCheck(this, EllipticalRoi);
  } // TODO: this function is required for all Cornerstone Tool Adapters, since it is called by MeasurementReport.


  _createClass(EllipticalRoi, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup) {
      var _MeasurementReport$ge = MeasurementReport$3.getSetupMeasurementData(MeasurementGroup),
          defaultState = _MeasurementReport$ge.defaultState,
          NUMGroup = _MeasurementReport$ge.NUMGroup,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup;

      var GraphicData = SCOORDGroup.GraphicData;
      var majorAxis = [{
        x: GraphicData[0],
        y: GraphicData[1]
      }, {
        x: GraphicData[2],
        y: GraphicData[3]
      }];
      var minorAxis = [{
        x: GraphicData[4],
        y: GraphicData[5]
      }, {
        x: GraphicData[6],
        y: GraphicData[7]
      }]; // Calculate two opposite corners of box defined by two axes.

      var minorAxisLength = Math.sqrt(Math.pow(minorAxis[0].x - minorAxis[1].x, 2) + Math.pow(minorAxis[0].y - minorAxis[1].y, 2));
      var minorAxisDirection = {
        x: (minorAxis[1].x - minorAxis[0].x) / minorAxisLength,
        y: (minorAxis[1].y - minorAxis[0].y) / minorAxisLength
      };
      var halfMinorAxisLength = minorAxisLength / 2; // First end point of major axis + half minor axis vector

      var corner1 = {
        x: majorAxis[0].x + minorAxisDirection.x * halfMinorAxisLength,
        y: majorAxis[0].y + minorAxisDirection.y * halfMinorAxisLength
      }; // Second end point of major axis - half of minor axis vector

      var corner2 = {
        x: majorAxis[1].x - minorAxisDirection.x * halfMinorAxisLength,
        y: majorAxis[1].y - minorAxisDirection.y * halfMinorAxisLength
      };

      var state = _objectSpread2(_objectSpread2({}, defaultState), {}, {
        toolType: EllipticalRoi.toolType,
        active: false,
        cachedStats: {
          area: NUMGroup ? NUMGroup.MeasuredValueSequence.NumericValue : 0
        },
        handles: {
          end: {
            x: corner1.x,
            y: corner1.y,
            highlight: false,
            active: false
          },
          initialRotation: 0,
          start: {
            x: corner2.x,
            y: corner2.y,
            highlight: false,
            active: false
          },
          textBox: {
            hasMoved: false,
            movesIndependently: false,
            drawnIndependently: true,
            allowedOutsideImage: true,
            hasBoundingBox: true
          }
        },
        invalidated: true,
        visible: true
      });

      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool) {
      var _tool$cachedStats = tool.cachedStats,
          cachedStats = _tool$cachedStats === void 0 ? {} : _tool$cachedStats,
          handles = tool.handles,
          finding = tool.finding,
          findingSites = tool.findingSites;
      var start = handles.start,
          end = handles.end;
      var area = cachedStats.area;
      var halfXLength = Math.abs(start.x - end.x) / 2;
      var halfYLength = Math.abs(start.y - end.y) / 2;
      var points = [];
      var center = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2
      };

      if (halfXLength > halfYLength) {
        // X-axis major
        // Major axis
        points.push({
          x: center.x - halfXLength,
          y: center.y
        });
        points.push({
          x: center.x + halfXLength,
          y: center.y
        }); // Minor axis

        points.push({
          x: center.x,
          y: center.y - halfYLength
        });
        points.push({
          x: center.x,
          y: center.y + halfYLength
        });
      } else {
        // Y-axis major
        // Major axis
        points.push({
          x: center.x,
          y: center.y - halfYLength
        });
        points.push({
          x: center.x,
          y: center.y + halfYLength
        }); // Minor axis

        points.push({
          x: center.x - halfXLength,
          y: center.y
        });
        points.push({
          x: center.x + halfXLength,
          y: center.y
        });
      }

      var trackingIdentifierTextValue = "cornerstoneTools@^4.0.0:EllipticalRoi";
      return {
        area: area,
        points: points,
        trackingIdentifierTextValue: trackingIdentifierTextValue,
        finding: finding,
        findingSites: findingSites || []
      };
    }
  }]);

  return EllipticalRoi;
}();

EllipticalRoi.toolType = ELLIPTICALROI$1;
EllipticalRoi.utilityToolType = ELLIPTICALROI$1;
EllipticalRoi.TID300Representation = Ellipse$1;

EllipticalRoi.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone4Tag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone4Tag !== CORNERSTONE_4_TAG) {
    return false;
  }

  return toolType === ELLIPTICALROI$1;
};

MeasurementReport$3.registerTool(EllipticalRoi);

/**
 * Expand an array of points stored as objects into
 * a flattened array of points
 *
 * @param points [{x: 0, y: 1}, {x: 1, y: 2}] or [{x: 0, y: 1, z: 0}, {x: 1, y: 2, z: 0}]
 * @return {Array} [point1x, point1y, point2x, point2y] or [point1x, point1y, point1z, point2x, point2y, point2z]
 */

function expandPoints$1(points) {
  var allPoints = [];
  points.forEach(function (point) {
    allPoints.push(point.x);
    allPoints.push(point.y);
  });
  return allPoints;
}

var Circle$1 = /*#__PURE__*/function (_TID300Measurement) {
  _inherits(Circle, _TID300Measurement);

  var _super = _createSuper(Circle);

  function Circle() {
    _classCallCheck(this, Circle);

    return _super.apply(this, arguments);
  }

  _createClass(Circle, [{
    key: "contentItem",
    value: function contentItem() {
      var _this$props = this.props,
          points = _this$props.points,
          ReferencedSOPSequence = _this$props.ReferencedSOPSequence,
          _this$props$use3DSpat = _this$props.use3DSpatialCoordinates,
          use3DSpatialCoordinates = _this$props$use3DSpat === void 0 ? false : _this$props$use3DSpat,
          perimeter = _this$props.perimeter,
          area = _this$props.area,
          _this$props$areaUnit = _this$props.areaUnit,
          areaUnit = _this$props$areaUnit === void 0 ? "mm2" : _this$props$areaUnit,
          _this$props$unit = _this$props.unit,
          unit = _this$props$unit === void 0 ? "mm" : _this$props$unit; // Combine all lengths to save the perimeter
      // @ToDO The permiter has to be implemented
      // const reducer = (accumulator, currentValue) => accumulator + currentValue;
      // const perimeter = lengths.reduce(reducer);

      var GraphicData = expandPoints$1(points); // TODO: Add Mean and STDev value of (modality?) pixels

      return this.getMeasurement([{
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "G-A197",
          CodingSchemeDesignator: "SRT",
          CodeMeaning: "Perimeter" // TODO: Look this up from a Code Meaning dictionary

        },
        MeasuredValueSequence: {
          MeasurementUnitsCodeSequence: unit2CodingValue(unit),
          NumericValue: perimeter
        },
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: use3DSpatialCoordinates ? "SCOORD3D" : "SCOORD",
          GraphicType: "CIRCLE",
          GraphicData: GraphicData,
          ContentSequence: use3DSpatialCoordinates ? undefined : {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }, {
        // TODO: This feels weird to repeat the GraphicData
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "G-A166",
          CodingSchemeDesignator: "SRT",
          CodeMeaning: "Area" // TODO: Look this up from a Code Meaning dictionary

        },
        MeasuredValueSequence: {
          MeasurementUnitsCodeSequence: unit2CodingValue(areaUnit),
          NumericValue: area
        },
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: use3DSpatialCoordinates ? "SCOORD3D" : "SCOORD",
          GraphicType: "CIRCLE",
          GraphicData: GraphicData,
          ContentSequence: use3DSpatialCoordinates ? undefined : {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }]);
    }
  }]);

  return Circle;
}(TID300Measurement);

var CIRCLEROI = "CircleRoi";

var CircleRoi = /*#__PURE__*/function () {
  function CircleRoi() {
    _classCallCheck(this, CircleRoi);
  }
  /** Gets the measurement data for cornerstone, given DICOM SR measurement data. */


  _createClass(CircleRoi, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup) {
      var _MeasurementReport$ge = MeasurementReport$3.getSetupMeasurementData(MeasurementGroup),
          defaultState = _MeasurementReport$ge.defaultState,
          NUMGroup = _MeasurementReport$ge.NUMGroup,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup;

      var GraphicData = SCOORDGroup.GraphicData;
      var center = {
        x: GraphicData[0],
        y: GraphicData[1]
      };
      var end = {
        x: GraphicData[2],
        y: GraphicData[3]
      };

      var state = _objectSpread2(_objectSpread2({}, defaultState), {}, {
        toolType: CircleRoi.toolType,
        active: false,
        cachedStats: {
          area: NUMGroup ? NUMGroup.MeasuredValueSequence.NumericValue : 0,
          // Dummy values to be updated by cornerstone
          radius: 0,
          perimeter: 0
        },
        handles: {
          end: _objectSpread2(_objectSpread2({}, end), {}, {
            highlight: false,
            active: false
          }),
          initialRotation: 0,
          start: _objectSpread2(_objectSpread2({}, center), {}, {
            highlight: false,
            active: false
          }),
          textBox: {
            hasMoved: false,
            movesIndependently: false,
            drawnIndependently: true,
            allowedOutsideImage: true,
            hasBoundingBox: true
          }
        },
        invalidated: true,
        visible: true
      });

      return state;
    }
    /**
     * Gets the TID 300 representation of a circle, given the cornerstone representation.
     *
     * @param {Object} tool
     * @returns
     */

  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool) {
      var _tool$cachedStats = tool.cachedStats,
          cachedStats = _tool$cachedStats === void 0 ? {} : _tool$cachedStats,
          handles = tool.handles,
          finding = tool.finding,
          findingSites = tool.findingSites;
      var center = handles.start,
          end = handles.end;
      var area = cachedStats.area,
          _cachedStats$areaUnit = cachedStats.areaUnit,
          areaUnit = _cachedStats$areaUnit === void 0 ? "mm2" : _cachedStats$areaUnit,
          _cachedStats$unit = cachedStats.unit,
          unit = _cachedStats$unit === void 0 ? "mm" : _cachedStats$unit,
          radius = cachedStats.radius;
      var perimeter = 2 * Math.PI * radius;
      var points = [];
      points.push(center);
      points.push(end);
      var trackingIdentifierTextValue = "cornerstoneTools@^4.0.0:CircleRoi";
      return {
        area: area,
        areaUnit: areaUnit,
        perimeter: perimeter,
        unit: unit,
        radius: radius,
        points: points,
        trackingIdentifierTextValue: trackingIdentifierTextValue,
        finding: finding,
        findingSites: findingSites || []
      };
    }
  }]);

  return CircleRoi;
}();

CircleRoi.toolType = CIRCLEROI;
CircleRoi.utilityToolType = CIRCLEROI;
CircleRoi.TID300Representation = Circle$1;

CircleRoi.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone4Tag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone4Tag !== CORNERSTONE_4_TAG) {
    return false;
  }

  return toolType === CIRCLEROI;
};

MeasurementReport$3.registerTool(CircleRoi);

var Point$1 = /*#__PURE__*/function (_TID300Measurement) {
  _inherits(Point, _TID300Measurement);

  var _super = _createSuper(Point);

  function Point() {
    _classCallCheck(this, Point);

    return _super.apply(this, arguments);
  }

  _createClass(Point, [{
    key: "contentItem",
    value: function contentItem() {
      var _this$props = this.props,
          points = _this$props.points,
          ReferencedSOPSequence = _this$props.ReferencedSOPSequence,
          _this$props$use3DSpat = _this$props.use3DSpatialCoordinates,
          use3DSpatialCoordinates = _this$props$use3DSpat === void 0 ? false : _this$props$use3DSpat;
      var GraphicData = use3DSpatialCoordinates ? [points[0].x, points[0].y, points[0].z] : [points[0].x, points[0].y]; // Allow storing another point as part of an indicator showing a single point

      if (points.length == 2) {
        GraphicData.push(points[1].x);
        GraphicData.push(points[1].y);
        if (use3DSpatialCoordinates) GraphicData.push(points[1].z);
      }

      return this.getMeasurement([{
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "111010",
          CodingSchemeDesignator: "DCM",
          CodeMeaning: "Center"
        },
        //MeasuredValueSequence: ,
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: use3DSpatialCoordinates ? "SCOORD3D" : "SCOORD",
          GraphicType: "POINT",
          GraphicData: GraphicData,
          ContentSequence: use3DSpatialCoordinates ? undefined : {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }]);
    }
  }]);

  return Point;
}(TID300Measurement);

var ARROW_ANNOTATE$1 = "ArrowAnnotate";
var CORNERSTONEFREETEXT$1 = "CORNERSTONEFREETEXT";

var ArrowAnnotate$1 = /*#__PURE__*/function () {
  function ArrowAnnotate() {
    _classCallCheck(this, ArrowAnnotate);
  }

  _createClass(ArrowAnnotate, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup) {
      var _MeasurementReport$ge = MeasurementReport$3.getSetupMeasurementData(MeasurementGroup),
          defaultState = _MeasurementReport$ge.defaultState,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup,
          findingGroup = _MeasurementReport$ge.findingGroup;

      var text = findingGroup.ConceptCodeSequence.CodeMeaning;
      var GraphicData = SCOORDGroup.GraphicData;

      var state = _objectSpread2(_objectSpread2({}, defaultState), {}, {
        toolType: ArrowAnnotate.toolType,
        active: false,
        handles: {
          start: {
            x: GraphicData[0],
            y: GraphicData[1],
            highlight: true,
            active: false
          },
          // Use a generic offset if the stored data doesn't have the endpoint, otherwise
          // use the actual endpoint.
          end: {
            x: GraphicData.length == 4 ? GraphicData[2] : GraphicData[0] + 20,
            y: GraphicData.length == 4 ? GraphicData[3] : GraphicData[1] + 20,
            highlight: true,
            active: false
          },
          textBox: {
            hasMoved: false,
            movesIndependently: false,
            drawnIndependently: true,
            allowedOutsideImage: true,
            hasBoundingBox: true
          }
        },
        invalidated: true,
        text: text,
        visible: true
      });

      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool) {
      var points = [tool.handles.start, tool.handles.end];
      var finding = tool.finding,
          findingSites = tool.findingSites;
      var TID300RepresentationArguments = {
        points: points,
        trackingIdentifierTextValue: "cornerstoneTools@^4.0.0:ArrowAnnotate",
        findingSites: findingSites || []
      }; // If freetext finding isn't present, add it from the tool text.

      if (!finding || finding.CodeValue !== CORNERSTONEFREETEXT$1) {
        finding = {
          CodeValue: CORNERSTONEFREETEXT$1,
          CodingSchemeDesignator: "CST4",
          CodeMeaning: tool.text
        };
      }

      TID300RepresentationArguments.finding = finding;
      return TID300RepresentationArguments;
    }
  }]);

  return ArrowAnnotate;
}();

ArrowAnnotate$1.toolType = ARROW_ANNOTATE$1;
ArrowAnnotate$1.utilityToolType = ARROW_ANNOTATE$1;
ArrowAnnotate$1.TID300Representation = Point$1;

ArrowAnnotate$1.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone4Tag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone4Tag !== CORNERSTONE_4_TAG) {
    return false;
  }

  return toolType === ARROW_ANNOTATE$1;
};

MeasurementReport$3.registerTool(ArrowAnnotate$1);

function iota$1(n) {
  var result = new Array(n);
  for(var i=0; i<n; ++i) {
    result[i] = i;
  }
  return result
}

var iota_1 = iota$1;

/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
var isBuffer_1 = function (obj) {
  return obj != null && (isBuffer$1(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
};

function isBuffer$1 (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer$1(obj.slice(0, 0))
}

var iota = iota_1;
var isBuffer = isBuffer_1;

var hasTypedArrays  = ((typeof Float64Array) !== "undefined");

function compare1st(a, b) {
  return a[0] - b[0]
}

function order() {
  var stride = this.stride;
  var terms = new Array(stride.length);
  var i;
  for(i=0; i<terms.length; ++i) {
    terms[i] = [Math.abs(stride[i]), i];
  }
  terms.sort(compare1st);
  var result = new Array(terms.length);
  for(i=0; i<result.length; ++i) {
    result[i] = terms[i][1];
  }
  return result
}

function compileConstructor(dtype, dimension) {
  var className = ["View", dimension, "d", dtype].join("");
  if(dimension < 0) {
    className = "View_Nil" + dtype;
  }
  var useGetters = (dtype === "generic");

  if(dimension === -1) {
    //Special case for trivial arrays
    var code =
      "function "+className+"(a){this.data=a;};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return -1};\
proto.size=0;\
proto.dimension=-1;\
proto.shape=proto.stride=proto.order=[];\
proto.lo=proto.hi=proto.transpose=proto.step=\
function(){return new "+className+"(this.data);};\
proto.get=proto.set=function(){};\
proto.pick=function(){return null};\
return function construct_"+className+"(a){return new "+className+"(a);}";
    var procedure = new Function(code);
    return procedure()
  } else if(dimension === 0) {
    //Special case for 0d arrays
    var code =
      "function "+className+"(a,d) {\
this.data = a;\
this.offset = d\
};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return this.offset};\
proto.dimension=0;\
proto.size=1;\
proto.shape=\
proto.stride=\
proto.order=[];\
proto.lo=\
proto.hi=\
proto.transpose=\
proto.step=function "+className+"_copy() {\
return new "+className+"(this.data,this.offset)\
};\
proto.pick=function "+className+"_pick(){\
return TrivialArray(this.data);\
};\
proto.valueOf=proto.get=function "+className+"_get(){\
return "+(useGetters ? "this.data.get(this.offset)" : "this.data[this.offset]")+
"};\
proto.set=function "+className+"_set(v){\
return "+(useGetters ? "this.data.set(this.offset,v)" : "this.data[this.offset]=v")+"\
};\
return function construct_"+className+"(a,b,c,d){return new "+className+"(a,d)}";
    var procedure = new Function("TrivialArray", code);
    return procedure(CACHED_CONSTRUCTORS[dtype][0])
  }

  var code = ["'use strict'"];

  //Create constructor for view
  var indices = iota(dimension);
  var args = indices.map(function(i) { return "i"+i });
  var index_str = "this.offset+" + indices.map(function(i) {
        return "this.stride[" + i + "]*i" + i
      }).join("+");
  var shapeArg = indices.map(function(i) {
      return "b"+i
    }).join(",");
  var strideArg = indices.map(function(i) {
      return "c"+i
    }).join(",");
  code.push(
    "function "+className+"(a," + shapeArg + "," + strideArg + ",d){this.data=a",
      "this.shape=[" + shapeArg + "]",
      "this.stride=[" + strideArg + "]",
      "this.offset=d|0}",
    "var proto="+className+".prototype",
    "proto.dtype='"+dtype+"'",
    "proto.dimension="+dimension);

  //view.size:
  code.push("Object.defineProperty(proto,'size',{get:function "+className+"_size(){\
return "+indices.map(function(i) { return "this.shape["+i+"]" }).join("*"),
"}})");

  //view.order:
  if(dimension === 1) {
    code.push("proto.order=[0]");
  } else {
    code.push("Object.defineProperty(proto,'order',{get:");
    if(dimension < 4) {
      code.push("function "+className+"_order(){");
      if(dimension === 2) {
        code.push("return (Math.abs(this.stride[0])>Math.abs(this.stride[1]))?[1,0]:[0,1]}})");
      } else if(dimension === 3) {
        code.push(
"var s0=Math.abs(this.stride[0]),s1=Math.abs(this.stride[1]),s2=Math.abs(this.stride[2]);\
if(s0>s1){\
if(s1>s2){\
return [2,1,0];\
}else if(s0>s2){\
return [1,2,0];\
}else{\
return [1,0,2];\
}\
}else if(s0>s2){\
return [2,0,1];\
}else if(s2>s1){\
return [0,1,2];\
}else{\
return [0,2,1];\
}}})");
      }
    } else {
      code.push("ORDER})");
    }
  }

  //view.set(i0, ..., v):
  code.push(
"proto.set=function "+className+"_set("+args.join(",")+",v){");
  if(useGetters) {
    code.push("return this.data.set("+index_str+",v)}");
  } else {
    code.push("return this.data["+index_str+"]=v}");
  }

  //view.get(i0, ...):
  code.push("proto.get=function "+className+"_get("+args.join(",")+"){");
  if(useGetters) {
    code.push("return this.data.get("+index_str+")}");
  } else {
    code.push("return this.data["+index_str+"]}");
  }

  //view.index:
  code.push(
    "proto.index=function "+className+"_index(", args.join(), "){return "+index_str+"}");

  //view.hi():
  code.push("proto.hi=function "+className+"_hi("+args.join(",")+"){return new "+className+"(this.data,"+
    indices.map(function(i) {
      return ["(typeof i",i,"!=='number'||i",i,"<0)?this.shape[", i, "]:i", i,"|0"].join("")
    }).join(",")+","+
    indices.map(function(i) {
      return "this.stride["+i + "]"
    }).join(",")+",this.offset)}");

  //view.lo():
  var a_vars = indices.map(function(i) { return "a"+i+"=this.shape["+i+"]" });
  var c_vars = indices.map(function(i) { return "c"+i+"=this.stride["+i+"]" });
  code.push("proto.lo=function "+className+"_lo("+args.join(",")+"){var b=this.offset,d=0,"+a_vars.join(",")+","+c_vars.join(","));
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'&&i"+i+">=0){\
d=i"+i+"|0;\
b+=c"+i+"*d;\
a"+i+"-=d}");
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a"+i
    }).join(",")+","+
    indices.map(function(i) {
      return "c"+i
    }).join(",")+",b)}");

  //view.step():
  code.push("proto.step=function "+className+"_step("+args.join(",")+"){var "+
    indices.map(function(i) {
      return "a"+i+"=this.shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "b"+i+"=this.stride["+i+"]"
    }).join(",")+",c=this.offset,d=0,ceil=Math.ceil");
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'){\
d=i"+i+"|0;\
if(d<0){\
c+=b"+i+"*(a"+i+"-1);\
a"+i+"=ceil(-a"+i+"/d)\
}else{\
a"+i+"=ceil(a"+i+"/d)\
}\
b"+i+"*=d\
}");
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a" + i
    }).join(",")+","+
    indices.map(function(i) {
      return "b" + i
    }).join(",")+",c)}");

  //view.transpose():
  var tShape = new Array(dimension);
  var tStride = new Array(dimension);
  for(var i=0; i<dimension; ++i) {
    tShape[i] = "a[i"+i+"]";
    tStride[i] = "b[i"+i+"]";
  }
  code.push("proto.transpose=function "+className+"_transpose("+args+"){"+
    args.map(function(n,idx) { return n + "=(" + n + "===undefined?" + idx + ":" + n + "|0)"}).join(";"),
    "var a=this.shape,b=this.stride;return new "+className+"(this.data,"+tShape.join(",")+","+tStride.join(",")+",this.offset)}");

  //view.pick():
  code.push("proto.pick=function "+className+"_pick("+args+"){var a=[],b=[],c=this.offset");
  for(var i=0; i<dimension; ++i) {
    code.push("if(typeof i"+i+"==='number'&&i"+i+">=0){c=(c+this.stride["+i+"]*i"+i+")|0}else{a.push(this.shape["+i+"]);b.push(this.stride["+i+"])}");
  }
  code.push("var ctor=CTOR_LIST[a.length+1];return ctor(this.data,a,b,c)}");

  //Add return statement
  code.push("return function construct_"+className+"(data,shape,stride,offset){return new "+className+"(data,"+
    indices.map(function(i) {
      return "shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "stride["+i+"]"
    }).join(",")+",offset)}");

  //Compile procedure
  var procedure = new Function("CTOR_LIST", "ORDER", code.join("\n"));
  return procedure(CACHED_CONSTRUCTORS[dtype], order)
}

function arrayDType(data) {
  if(isBuffer(data)) {
    return "buffer"
  }
  if(hasTypedArrays) {
    switch(Object.prototype.toString.call(data)) {
      case "[object Float64Array]":
        return "float64"
      case "[object Float32Array]":
        return "float32"
      case "[object Int8Array]":
        return "int8"
      case "[object Int16Array]":
        return "int16"
      case "[object Int32Array]":
        return "int32"
      case "[object Uint8Array]":
        return "uint8"
      case "[object Uint16Array]":
        return "uint16"
      case "[object Uint32Array]":
        return "uint32"
      case "[object Uint8ClampedArray]":
        return "uint8_clamped"
      case "[object BigInt64Array]":
        return "bigint64"
      case "[object BigUint64Array]":
        return "biguint64"
    }
  }
  if(Array.isArray(data)) {
    return "array"
  }
  return "generic"
}

var CACHED_CONSTRUCTORS = {
  "float32":[],
  "float64":[],
  "int8":[],
  "int16":[],
  "int32":[],
  "uint8":[],
  "uint16":[],
  "uint32":[],
  "array":[],
  "uint8_clamped":[],
  "bigint64": [],
  "biguint64": [],
  "buffer":[],
  "generic":[]
}

;
function wrappedNDArrayCtor(data, shape, stride, offset) {
  if(data === undefined) {
    var ctor = CACHED_CONSTRUCTORS.array[0];
    return ctor([])
  } else if(typeof data === "number") {
    data = [data];
  }
  if(shape === undefined) {
    shape = [ data.length ];
  }
  var d = shape.length;
  if(stride === undefined) {
    stride = new Array(d);
    for(var i=d-1, sz=1; i>=0; --i) {
      stride[i] = sz;
      sz *= shape[i];
    }
  }
  if(offset === undefined) {
    offset = 0;
    for(var i=0; i<d; ++i) {
      if(stride[i] < 0) {
        offset -= (shape[i]-1)*stride[i];
      }
    }
  }
  var dtype = arrayDType(data);
  var ctor_list = CACHED_CONSTRUCTORS[dtype];
  while(ctor_list.length <= d+1) {
    ctor_list.push(compileConstructor(dtype, ctor_list.length-1));
  }
  var ctor = ctor_list[d+1];
  return ctor(data, shape, stride, offset)
}

var ndarray = wrappedNDArrayCtor;

var ndarray$1 = /*@__PURE__*/getDefaultExportFromCjs(ndarray);

/**
 * crossProduct3D - Returns the cross product of a and b.
 *
 * @param  {Number[3]} a Vector a.
 * @param  {Number[3]} b Vector b.
 * @return {Number[3]}   The cross product.
 */
function crossProduct3D (a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

var flipImageOrientationPatient = {
  /**
   * h: Flips ImageOrientationPatient in the horizontal direction.
   * @param {Number[6]} iop - ImageOrientationPatient
   * @returns {Number[6]} The transformed ImageOrientationPatient
   */
  h: function h(iop) {
    return [iop[0], iop[1], iop[2], -iop[3], -iop[4], -iop[5]];
  },

  /**
   * v: Flips ImageOrientationPatient in the vertical direction.
   * @param {Number[6]} iop - ImageOrientationPatient
   * @returns {Number[6]} The transformed ImageOrientationPatient
   */
  v: function v(iop) {
    return [-iop[0], -iop[1], -iop[2], iop[3], iop[4], iop[5]];
  },

  /**
   * hv: Flips ImageOrientationPatient in the horizontal and vertical directions.
   * @param {Number[6]} iop - ImageOrientationPatient
   * @returns {Number[6]} The transformed ImageOrientationPatient
   */
  hv: function hv(iop) {
    return [-iop[0], -iop[1], -iop[2], -iop[3], -iop[4], -iop[5]];
  }
};

/**
 * rotateVectorAroundUnitVector - Rotates vector v around unit vector k using
 *                                Rodrigues' rotation formula.
 *
 * @param  {Number[3]} v     The vector to rotate.
 * @param  {Number[3]} k     The unit vector of the axis of rotation.
 * @param  {Number} theta    The rotation magnitude in radians.
 * @return {Number[3]}       The rotated v vector.
 */

function rotateVectorAroundUnitVector (v, k, theta) {
  var cosTheta = Math.cos(theta);
  var sinTheta = Math.sin(theta);
  var oneMinusCosTheta = 1.0 - cosTheta;
  var kdotv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  var vRot = [];
  var kxv = crossProduct3D(k, v);

  for (var i = 0; i <= 2; i++) {
    vRot[i] = v[i] * cosTheta + kxv[i] * sinTheta + k[i] * kdotv * oneMinusCosTheta;
    vRot[i] *= -1;
  }

  return vRot;
}

/**
 * rotateDirectionCosinesInPlane - rotates the row and column cosines around
 * their normal by angle theta.
 *
 * @param  {Number[6]} iop   The row (0..2) an column (3..5) direction cosines.
 * @param  {Number} theta The rotation magnitude in radians.
 * @return {Number[6]}       The rotate row (0..2) and column (3..5) direction cosines.
 */

function rotateDirectionCosinesInPlane (iop, theta) {
  var r = [iop[0], iop[1], iop[2]];
  var c = [iop[3], iop[4], iop[5]];
  var rxc = crossProduct3D(r, c);
  var rRot = rotateVectorAroundUnitVector(r, rxc, theta);
  var cRot = rotateVectorAroundUnitVector(c, rxc, theta);
  return [].concat(_toConsumableArray(rRot), _toConsumableArray(cRot));
}

var flipMatrix2D = {
  h: h,
  v: v
};
/**
 * flipMatrix2D.h - Flips a 2D matrix in the horizontal direction.
 *
 * @param  {Ndarry} matrix The matrix to flip.
 * @return {Ndarry}   The flipped matrix.
 */

function h(matrix) {
  var _matrix$shape = _slicedToArray(matrix.shape, 2),
      rows = _matrix$shape[0],
      cols = _matrix$shape[1];

  var result = ndarray$1(new Uint8Array(rows * cols), [rows, cols]);

  for (var i = 0; i < rows; i++) {
    for (var j = 0; j < cols; j++) {
      result.set(i, j, matrix.get(i, cols - 1 - j));
    }
  }

  return result;
}
/**
 * flipMatrix2D.h - Flips a 2D matrix in the vertical direction.
 *
 * @param  {Ndarry} matrix The matrix to flip.
 * @return {Ndarry}   The flipped matrix.
 */


function v(matrix) {
  var _matrix$shape2 = _slicedToArray(matrix.shape, 2),
      rows = _matrix$shape2[0],
      cols = _matrix$shape2[1];

  var result = ndarray$1(new Uint8Array(rows * cols), [rows, cols]);

  for (var j = 0; j < cols; j++) {
    for (var i = 0; i < rows; i++) {
      result.set(i, j, matrix.get(rows - 1 - i, j));
    }
  }

  return result;
}

/**
 * anonymous function - Rotates a matrix by 90 degrees.
 *
 * @param  {Ndarray} matrix The matrix to rotate.
 * @return {Ndarry}        The rotated matrix.
 */

function rotateMatrix902D (matrix) {
  var _matrix$shape = _slicedToArray(matrix.shape, 2),
      rows = _matrix$shape[0],
      cols = _matrix$shape[1]; //debugPrintMatrix(matrix);


  var result = ndarray$1(new Uint8Array(rows * cols), [cols, rows]);
  var resultColsMinus1 = result.shape[1] - 1;

  for (var i = 0; i < rows; i++) {
    for (var j = 0; j < cols; j++) {
      result.set(j, resultColsMinus1 - i, matrix.get(i, j));
    }
  } //debugPrintMatrix(result);


  return result;
}

/**
 * nearlyEqual - Returns true if a and b are nearly equal
 * within a tolerance.
 *
 * Inspiration for this function logic source comes from:
 * https://floating-point-gui.de/errors/comparison/
 *
 * https://floating-point-gui.de is published under
 * the Creative Commons Attribution License (BY):
 * http://creativecommons.org/licenses/by/3.0/
 *
 * The actual implementation has been adjusted 
 * as discussed here: https://github.com/dcmjs-org/dcmjs/pull/304
 *
 * More information on floating point comparison here:
 * http://randomascii.wordpress.com/2012/02/25/comparing-floating-point-numbers-2012-edition/
 *
 * @param {Number} a
 * @param {Number} b
 * @param {Number} tolerance.
 * @return {Boolean} True if a and b are nearly equal.
 */
function nearlyEqual(a, b, epsilon) {
  var absA = Math.abs(a);
  var absB = Math.abs(b);
  var diff = Math.abs(a - b);

  if (a === b) {
    // shortcut, handles infinities
    return true;
  } else if (a === 0 || b === 0 || absA + absB < epsilon * epsilon) {
    // a or b is zero or both are extremely close to it
    // relative error is less meaningful here
    return diff < epsilon;
  } else {
    // use relative error
    return diff / Math.min(absA + absB, Number.MAX_VALUE) < epsilon;
  }
}

var orientation = /*#__PURE__*/Object.freeze({
	__proto__: null,
	crossProduct3D: crossProduct3D,
	flipImageOrientationPatient: flipImageOrientationPatient,
	flipMatrix2D: flipMatrix2D,
	nearlyEqual: nearlyEqual,
	rotateDirectionCosinesInPlane: rotateDirectionCosinesInPlane,
	rotateMatrix902D: rotateMatrix902D,
	rotateVectorAroundUnitVector: rotateVectorAroundUnitVector
});

var Segmentation$3 = {
  generateSegmentation: generateSegmentation$2,
  generateToolState: generateToolState$2
};
/**
 *
 * @typedef {Object} BrushData
 * @property {Object} toolState - The cornerstoneTools global toolState.
 * @property {Object[]} segments - The cornerstoneTools segment metadata that corresponds to the
 *                                 seriesInstanceUid.
 */

/**
 * generateSegmentation - Generates cornerstoneTools brush data, given a stack of
 * imageIds, images and the cornerstoneTools brushData.
 *
 * @param  {object[]} images    An array of the cornerstone image objects.
 * @param  {BrushData} brushData and object containing the brushData.
 * @returns {type}           description
 */

function generateSegmentation$2(images, brushData) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
    includeSliceSpacing: true
  };
  var toolState = brushData.toolState,
      segments = brushData.segments; // Calculate the dimensions of the data cube.

  var image0 = images[0];
  var dims = {
    x: image0.columns,
    y: image0.rows,
    z: images.length
  };
  dims.xy = dims.x * dims.y;

  var numSegments = _getSegCount(seg, segments);

  if (!numSegments) {
    throw new Error("No segments to export!");
  }

  var isMultiframe = image0.imageId.includes("?frame");

  var seg = _createSegFromImages$1(images, isMultiframe, options);

  var _getNumberOfFramesPer = _getNumberOfFramesPerSegment(toolState, images, segments),
      referencedFramesPerSegment = _getNumberOfFramesPer.referencedFramesPerSegment,
      segmentIndicies = _getNumberOfFramesPer.segmentIndicies;

  var NumberOfFrames = 0;

  for (var i = 0; i < referencedFramesPerSegment.length; i++) {
    NumberOfFrames += referencedFramesPerSegment[i].length;
  }

  seg.setNumberOfFrames(NumberOfFrames);

  for (var _i = 0; _i < segmentIndicies.length; _i++) {
    var segmentIndex = segmentIndicies[_i];
    var referencedFrameIndicies = referencedFramesPerSegment[_i]; // Frame numbers start from 1.

    var referencedFrameNumbers = referencedFrameIndicies.map(function (element) {
      return element + 1;
    });
    var segment = segments[segmentIndex];
    seg.addSegment(segment, _extractCornerstoneToolsPixelData(segmentIndex, referencedFrameIndicies, toolState, images, dims), referencedFrameNumbers);
  }

  seg.bitPackPixelData();
  var segBlob = datasetToBlob(seg.dataset);
  return segBlob;
}

function _extractCornerstoneToolsPixelData(segmentIndex, referencedFrames, toolState, images, dims) {
  var pixelData = new Uint8Array(dims.xy * referencedFrames.length);
  var pixelDataIndex = 0;

  for (var i = 0; i < referencedFrames.length; i++) {
    var frame = referencedFrames[i];
    var imageId = images[frame].imageId;
    var imageIdSpecificToolState = toolState[imageId];
    var brushPixelData = imageIdSpecificToolState.brush.data[segmentIndex].pixelData;

    for (var p = 0; p < brushPixelData.length; p++) {
      pixelData[pixelDataIndex] = brushPixelData[p];
      pixelDataIndex++;
    }
  }

  return pixelData;
}

function _getNumberOfFramesPerSegment(toolState, images, segments) {
  var segmentIndicies = [];
  var referencedFramesPerSegment = [];

  for (var i = 0; i < segments.length; i++) {
    if (segments[i]) {
      segmentIndicies.push(i);
      referencedFramesPerSegment.push([]);
    }
  }

  for (var z = 0; z < images.length; z++) {
    var imageId = images[z].imageId;
    var imageIdSpecificToolState = toolState[imageId];

    for (var _i2 = 0; _i2 < segmentIndicies.length; _i2++) {
      var segIdx = segmentIndicies[_i2];

      if (imageIdSpecificToolState && imageIdSpecificToolState.brush && imageIdSpecificToolState.brush.data && imageIdSpecificToolState.brush.data[segIdx] && imageIdSpecificToolState.brush.data[segIdx].pixelData) {
        referencedFramesPerSegment[_i2].push(z);
      }
    }
  }

  return {
    referencedFramesPerSegment: referencedFramesPerSegment,
    segmentIndicies: segmentIndicies
  };
}

function _getSegCount(seg, segments) {
  var numSegments = 0;

  for (var i = 0; i < segments.length; i++) {
    if (segments[i]) {
      numSegments++;
    }
  }

  return numSegments;
}
/**
 * _createSegFromImages - description
 *
 * @param  {Object[]} images    An array of the cornerstone image objects.
 * @param  {Boolean} isMultiframe Whether the images are multiframe.
 * @returns {Object}              The Seg derived dataSet.
 */


function _createSegFromImages$1(images, isMultiframe, options) {
  var datasets = [];

  if (isMultiframe) {
    var image = images[0];
    var arrayBuffer = image.data.byteArray.buffer;
    var dicomData = DicomMessage.readFile(arrayBuffer);
    var dataset = DicomMetaDictionary.naturalizeDataset(dicomData.dict);
    dataset._meta = DicomMetaDictionary.namifyDataset(dicomData.meta);
    datasets.push(dataset);
  } else {
    for (var i = 0; i < images.length; i++) {
      var _image = images[i];
      var _arrayBuffer = _image.data.byteArray.buffer;

      var _dicomData = DicomMessage.readFile(_arrayBuffer);

      var _dataset = DicomMetaDictionary.naturalizeDataset(_dicomData.dict);

      _dataset._meta = DicomMetaDictionary.namifyDataset(_dicomData.meta);
      datasets.push(_dataset);
    }
  }

  var multiframe = Normalizer.normalizeToDataset(datasets);
  return new Segmentation$4([multiframe], options);
}
/**
 * generateToolState - Given a set of cornrstoneTools imageIds and a Segmentation buffer,
 * derive cornerstoneTools toolState and brush metadata.
 *
 * @param  {string[]} imageIds    An array of the imageIds.
 * @param  {ArrayBuffer} arrayBuffer The SEG arrayBuffer.
 * @param {*} metadataProvider
 * @returns {Object}  The toolState and an object from which the
 *                    segment metadata can be derived.
 */


function generateToolState$2(imageIds, arrayBuffer, metadataProvider) {
  var dicomData = DicomMessage.readFile(arrayBuffer);
  var dataset = DicomMetaDictionary.naturalizeDataset(dicomData.dict);
  dataset._meta = DicomMetaDictionary.namifyDataset(dicomData.meta);
  var multiframe = Normalizer.normalizeToDataset([dataset]);
  var imagePlaneModule = metadataProvider.get("imagePlaneModule", imageIds[0]);

  if (!imagePlaneModule) {
    console.warn("Insufficient metadata, imagePlaneModule missing.");
  }

  var ImageOrientationPatient = Array.isArray(imagePlaneModule.rowCosines) ? [].concat(_toConsumableArray(imagePlaneModule.rowCosines), _toConsumableArray(imagePlaneModule.columnCosines)) : [imagePlaneModule.rowCosines.x, imagePlaneModule.rowCosines.y, imagePlaneModule.rowCosines.z, imagePlaneModule.columnCosines.x, imagePlaneModule.columnCosines.y, imagePlaneModule.columnCosines.z]; // Get IOP from ref series, compute supported orientations:

  var validOrientations = getValidOrientations$1(ImageOrientationPatient);
  var SharedFunctionalGroupsSequence = multiframe.SharedFunctionalGroupsSequence;
  var sharedImageOrientationPatient = SharedFunctionalGroupsSequence.PlaneOrientationSequence ? SharedFunctionalGroupsSequence.PlaneOrientationSequence.ImageOrientationPatient : undefined;
  var sliceLength = multiframe.Columns * multiframe.Rows;
  var segMetadata = getSegmentMetadata$1(multiframe);
  var pixelData = unpackPixelData$1(multiframe);
  var PerFrameFunctionalGroupsSequence = multiframe.PerFrameFunctionalGroupsSequence;
  var toolState = {};
  var inPlane = true;

  for (var i = 0; i < PerFrameFunctionalGroupsSequence.length; i++) {
    var PerFrameFunctionalGroups = PerFrameFunctionalGroupsSequence[i];
    var ImageOrientationPatientI = sharedImageOrientationPatient || PerFrameFunctionalGroups.PlaneOrientationSequence.ImageOrientationPatient;
    var pixelDataI2D = ndarray$1(new Uint8Array(pixelData.buffer, i * sliceLength, sliceLength), [multiframe.Rows, multiframe.Columns]);
    var alignedPixelDataI = alignPixelDataWithSourceData$1(pixelDataI2D, ImageOrientationPatientI, validOrientations);

    if (!alignedPixelDataI) {
      console.warn("This segmentation object is not in-plane with the source data. Bailing out of IO. It'd be better to render this with vtkjs. ");
      inPlane = false;
      break;
    }

    var segmentIndex = PerFrameFunctionalGroups.SegmentIdentificationSequence.ReferencedSegmentNumber - 1;
    var SourceImageSequence = void 0;

    if (SharedFunctionalGroupsSequence.DerivationImageSequence && SharedFunctionalGroupsSequence.DerivationImageSequence.SourceImageSequence) {
      SourceImageSequence = SharedFunctionalGroupsSequence.DerivationImageSequence.SourceImageSequence[i];
    } else {
      SourceImageSequence = PerFrameFunctionalGroups.DerivationImageSequence.SourceImageSequence;
    }

    var imageId = getImageIdOfSourceImage(SourceImageSequence, imageIds, metadataProvider);
    addImageIdSpecificBrushToolState(toolState, imageId, segmentIndex, alignedPixelDataI);
  }

  if (!inPlane) {
    return;
  }

  return {
    toolState: toolState,
    segMetadata: segMetadata
  };
}
/**
 * unpackPixelData - Unpacks bitpacked pixelData if the Segmentation is BINARY.
 *
 * @param  {Object} multiframe The multiframe dataset.
 * @return {Uint8Array}      The unpacked pixelData.
 */


function unpackPixelData$1(multiframe) {
  var segType = multiframe.SegmentationType;

  if (segType === "BINARY") {
    return BitArray.unpack(multiframe.PixelData);
  }

  var pixelData = new Uint8Array(multiframe.PixelData);
  var max = multiframe.MaximumFractionalValue;
  var onlyMaxAndZero = pixelData.find(function (element) {
    return element !== 0 && element !== max;
  }) === undefined;

  if (!onlyMaxAndZero) {
    log.warn("This is a fractional segmentation, which is not currently supported.");
    return;
  }

  log.warn("This segmentation object is actually binary... processing as such.");
  return pixelData;
}
/**
 * addImageIdSpecificBrushToolState - Adds brush pixel data to cornerstoneTools
 * formatted toolState object.
 *
 * @param  {Object} toolState    The toolState object to modify
 * @param  {String} imageId      The imageId of the toolState to add the data.
 * @param  {Number} segmentIndex The index of the segment data being added.
 * @param  {Ndarray} pixelData2D  The pixelData in Ndarry 2D format.
 */


function addImageIdSpecificBrushToolState(toolState, imageId, segmentIndex, pixelData2D) {
  if (!toolState[imageId]) {
    toolState[imageId] = {};
    toolState[imageId].brush = {};
    toolState[imageId].brush.data = [];
  } else if (!toolState[imageId].brush) {
    toolState[imageId].brush = {};
    toolState[imageId].brush.data = [];
  } else if (!toolState[imageId].brush.data) {
    toolState[imageId].brush.data = [];
  }

  toolState[imageId].brush.data[segmentIndex] = {};
  var brushDataI = toolState[imageId].brush.data[segmentIndex];
  brushDataI.pixelData = new Uint8Array(pixelData2D.data.length);
  var cToolsPixelData = brushDataI.pixelData;

  var _pixelData2D$shape = _slicedToArray(pixelData2D.shape, 2);
      _pixelData2D$shape[0];
      _pixelData2D$shape[1];

  for (var p = 0; p < cToolsPixelData.length; p++) {
    if (pixelData2D.data[p]) {
      cToolsPixelData[p] = 1;
    } else {
      cToolsPixelData[p] = 0;
    }
  }
}
/**
 * getImageIdOfSourceImage - Returns the Cornerstone imageId of the source image.
 *
 * @param  {Object} SourceImageSequence Sequence describing the source image.
 * @param  {String[]} imageIds          A list of imageIds.
 * @param  {Object} metadataProvider    A Cornerstone metadataProvider to query
 *                                      metadata from imageIds.
 * @return {String}                     The corresponding imageId.
 */


function getImageIdOfSourceImage(SourceImageSequence, imageIds, metadataProvider) {
  var ReferencedSOPInstanceUID = SourceImageSequence.ReferencedSOPInstanceUID,
      ReferencedFrameNumber = SourceImageSequence.ReferencedFrameNumber;
  return ReferencedFrameNumber ? getImageIdOfReferencedFrame$1(ReferencedSOPInstanceUID, ReferencedFrameNumber, imageIds, metadataProvider) : getImageIdOfReferencedSingleFramedSOPInstance$1(ReferencedSOPInstanceUID, imageIds, metadataProvider);
}
/**
 * getImageIdOfReferencedSingleFramedSOPInstance - Returns the imageId
 * corresponding to the specified sopInstanceUid for single-frame images.
 *
 * @param  {String} sopInstanceUid   The sopInstanceUid of the desired image.
 * @param  {String[]} imageIds         The list of imageIds.
 * @param  {Object} metadataProvider The metadataProvider to obtain sopInstanceUids
 *                                 from the cornerstone imageIds.
 * @return {String}                  The imageId that corresponds to the sopInstanceUid.
 */


function getImageIdOfReferencedSingleFramedSOPInstance$1(sopInstanceUid, imageIds, metadataProvider) {
  return imageIds.find(function (imageId) {
    var sopCommonModule = metadataProvider.get("sopCommonModule", imageId);

    if (!sopCommonModule) {
      return;
    }

    return sopCommonModule.sopInstanceUID === sopInstanceUid;
  });
}
/**
 * getImageIdOfReferencedFrame - Returns the imageId corresponding to the
 * specified sopInstanceUid and frameNumber for multi-frame images.
 *
 * @param  {String} sopInstanceUid   The sopInstanceUid of the desired image.
 * @param  {Number} frameNumber      The frame number.
 * @param  {String} imageIds         The list of imageIds.
 * @param  {Object} metadataProvider The metadataProvider to obtain sopInstanceUids
 *                                   from the cornerstone imageIds.
 * @return {String}                  The imageId that corresponds to the sopInstanceUid.
 */


function getImageIdOfReferencedFrame$1(sopInstanceUid, frameNumber, imageIds, metadataProvider) {
  var imageId = imageIds.find(function (imageId) {
    var sopCommonModule = metadataProvider.get("sopCommonModule", imageId);

    if (!sopCommonModule) {
      return;
    }

    var imageIdFrameNumber = Number(imageId.split("frame=")[1]);
    return (//frameNumber is zero indexed for cornerstoneWADOImageLoader image Ids.
      sopCommonModule.sopInstanceUID === sopInstanceUid && imageIdFrameNumber === frameNumber - 1
    );
  });
  return imageId;
}
/**
 * getValidOrientations - returns an array of valid orientations.
 *
 * @param  {Number[6]} iop The row (0..2) an column (3..5) direction cosines.
 * @return {Number[8][6]} An array of valid orientations.
 */


function getValidOrientations$1(iop) {
  var orientations = []; // [0,  1,  2]: 0,   0hf,   0vf
  // [3,  4,  5]: 90,  90hf,  90vf
  // [6, 7]:      180, 270

  orientations[0] = iop;
  orientations[1] = flipImageOrientationPatient.h(iop);
  orientations[2] = flipImageOrientationPatient.v(iop);
  var iop90 = rotateDirectionCosinesInPlane(iop, Math.PI / 2);
  orientations[3] = iop90;
  orientations[4] = flipImageOrientationPatient.h(iop90);
  orientations[5] = flipImageOrientationPatient.v(iop90);
  orientations[6] = rotateDirectionCosinesInPlane(iop, Math.PI);
  orientations[7] = rotateDirectionCosinesInPlane(iop, 1.5 * Math.PI);
  return orientations;
}
/**
 * alignPixelDataWithSourceData -
 *
 * @param {Ndarray} pixelData2D The data to align.
 * @param  {Number[6]} iop The orientation of the image slice.
 * @param  {Number[8][6]} orientations   An array of valid imageOrientationPatient values.
 * @return {Ndarray}                         The aligned pixelData.
 */


function alignPixelDataWithSourceData$1(pixelData2D, iop, orientations) {
  if (compareIOP(iop, orientations[0])) {
    //Same orientation.
    return pixelData2D;
  } else if (compareIOP(iop, orientations[1])) {
    //Flipped vertically.
    return flipMatrix2D.v(pixelData2D);
  } else if (compareIOP(iop, orientations[2])) {
    //Flipped horizontally.
    return flipMatrix2D.h(pixelData2D);
  } else if (compareIOP(iop, orientations[3])) {
    //Rotated 90 degrees.
    return rotateMatrix902D(pixelData2D);
  } else if (compareIOP(iop, orientations[4])) {
    //Rotated 90 degrees and fliped horizontally.
    return flipMatrix2D.h(rotateMatrix902D(pixelData2D));
  } else if (compareIOP(iop, orientations[5])) {
    //Rotated 90 degrees and fliped vertically.
    return flipMatrix2D.v(rotateMatrix902D(pixelData2D));
  } else if (compareIOP(iop, orientations[6])) {
    //Rotated 180 degrees. // TODO -> Do this more effeciently, there is a 1:1 mapping like 90 degree rotation.
    return rotateMatrix902D(rotateMatrix902D(pixelData2D));
  } else if (compareIOP(iop, orientations[7])) {
    //Rotated 270 degrees.  // TODO -> Do this more effeciently, there is a 1:1 mapping like 90 degree rotation.
    return rotateMatrix902D(rotateMatrix902D(rotateMatrix902D(pixelData2D)));
  }
}

var dx = 1e-5;
/**
 * compareIOP - Returns true if iop1 and iop2 are equal
 * within a tollerance, dx.
 *
 * @param  {Number[6]} iop1 An ImageOrientationPatient array.
 * @param  {Number[6]} iop2 An ImageOrientationPatient array.
 * @return {Boolean}      True if iop1 and iop2 are equal.
 */

function compareIOP(iop1, iop2) {
  return Math.abs(iop1[0] - iop2[0]) < dx && Math.abs(iop1[1] - iop2[1]) < dx && Math.abs(iop1[2] - iop2[2]) < dx && Math.abs(iop1[3] - iop2[3]) < dx && Math.abs(iop1[4] - iop2[4]) < dx && Math.abs(iop1[5] - iop2[5]) < dx;
}

function getSegmentMetadata$1(multiframe) {
  var data = [];
  var segmentSequence = multiframe.SegmentSequence;

  if (Array.isArray(segmentSequence)) {
    for (var segIdx = 0; segIdx < segmentSequence.length; segIdx++) {
      data.push(segmentSequence[segIdx]);
    }
  } else {
    // Only one segment, will be stored as an object.
    data.push(segmentSequence);
  }

  return {
    seriesInstanceUid: multiframe.ReferencedSeriesSequence.SeriesInstanceUID,
    data: data
  };
}

/**
 * Common utilities
 * @module glMatrix
 */
// Configuration Constants
var EPSILON$1 = 0.000001;
var ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
var RANDOM = Math.random;
if (!Math.hypot) Math.hypot = function () {
  var y = 0,
      i = arguments.length;

  while (i--) {
    y += arguments[i] * arguments[i];
  }

  return Math.sqrt(y);
};

/**
 * 3 Dimensional Vector
 * @module vec3
 */

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */

function create() {
  var out = new ARRAY_TYPE(3);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  return out;
}
/**
 * Creates a new vec3 initialized with values from an existing vector
 *
 * @param {ReadonlyVec3} a vector to clone
 * @returns {vec3} a new 3D vector
 */

function clone(a) {
  var out = new ARRAY_TYPE(3);
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}
/**
 * Calculates the length of a vec3
 *
 * @param {ReadonlyVec3} a vector to calculate length of
 * @returns {Number} length of a
 */

function length(a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  return Math.hypot(x, y, z);
}
/**
 * Creates a new vec3 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} a new 3D vector
 */

function fromValues(x, y, z) {
  var out = new ARRAY_TYPE(3);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
/**
 * Copy the values from one vec3 to another
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the source vector
 * @returns {vec3} out
 */

function copy(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}
/**
 * Set the components of a vec3 to the given values
 *
 * @param {vec3} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} out
 */

function set(out, x, y, z) {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
/**
 * Adds two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function add(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}
/**
 * Subtracts vector b from vector a
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function subtract$1(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}
/**
 * Multiplies two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function multiply(out, a, b) {
  out[0] = a[0] * b[0];
  out[1] = a[1] * b[1];
  out[2] = a[2] * b[2];
  return out;
}
/**
 * Divides two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function divide(out, a, b) {
  out[0] = a[0] / b[0];
  out[1] = a[1] / b[1];
  out[2] = a[2] / b[2];
  return out;
}
/**
 * Math.ceil the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to ceil
 * @returns {vec3} out
 */

function ceil(out, a) {
  out[0] = Math.ceil(a[0]);
  out[1] = Math.ceil(a[1]);
  out[2] = Math.ceil(a[2]);
  return out;
}
/**
 * Math.floor the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to floor
 * @returns {vec3} out
 */

function floor(out, a) {
  out[0] = Math.floor(a[0]);
  out[1] = Math.floor(a[1]);
  out[2] = Math.floor(a[2]);
  return out;
}
/**
 * Returns the minimum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function min(out, a, b) {
  out[0] = Math.min(a[0], b[0]);
  out[1] = Math.min(a[1], b[1]);
  out[2] = Math.min(a[2], b[2]);
  return out;
}
/**
 * Returns the maximum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function max(out, a, b) {
  out[0] = Math.max(a[0], b[0]);
  out[1] = Math.max(a[1], b[1]);
  out[2] = Math.max(a[2], b[2]);
  return out;
}
/**
 * Math.round the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to round
 * @returns {vec3} out
 */

function round(out, a) {
  out[0] = Math.round(a[0]);
  out[1] = Math.round(a[1]);
  out[2] = Math.round(a[2]);
  return out;
}
/**
 * Scales a vec3 by a scalar number
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec3} out
 */

function scale(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
  return out;
}
/**
 * Adds two vec3's after scaling the second operand by a scalar value
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec3} out
 */

function scaleAndAdd(out, a, b, scale) {
  out[0] = a[0] + b[0] * scale;
  out[1] = a[1] + b[1] * scale;
  out[2] = a[2] + b[2] * scale;
  return out;
}
/**
 * Calculates the euclidian distance between two vec3's
 *
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {Number} distance between a and b
 */

function distance(a, b) {
  var x = b[0] - a[0];
  var y = b[1] - a[1];
  var z = b[2] - a[2];
  return Math.hypot(x, y, z);
}
/**
 * Calculates the squared euclidian distance between two vec3's
 *
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {Number} squared distance between a and b
 */

function squaredDistance(a, b) {
  var x = b[0] - a[0];
  var y = b[1] - a[1];
  var z = b[2] - a[2];
  return x * x + y * y + z * z;
}
/**
 * Calculates the squared length of a vec3
 *
 * @param {ReadonlyVec3} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */

function squaredLength(a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  return x * x + y * y + z * z;
}
/**
 * Negates the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to negate
 * @returns {vec3} out
 */

function negate(out, a) {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  return out;
}
/**
 * Returns the inverse of the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to invert
 * @returns {vec3} out
 */

function inverse(out, a) {
  out[0] = 1.0 / a[0];
  out[1] = 1.0 / a[1];
  out[2] = 1.0 / a[2];
  return out;
}
/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to normalize
 * @returns {vec3} out
 */

function normalize$1(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var len = x * x + y * y + z * z;

  if (len > 0) {
    //TODO: evaluate use of glm_invsqrt here?
    len = 1 / Math.sqrt(len);
  }

  out[0] = a[0] * len;
  out[1] = a[1] * len;
  out[2] = a[2] * len;
  return out;
}
/**
 * Calculates the dot product of two vec3's
 *
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {Number} dot product of a and b
 */

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
/**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function cross$1(out, a, b) {
  var ax = a[0],
      ay = a[1],
      az = a[2];
  var bx = b[0],
      by = b[1],
      bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}
/**
 * Performs a linear interpolation between two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {vec3} out
 */

function lerp(out, a, b, t) {
  var ax = a[0];
  var ay = a[1];
  var az = a[2];
  out[0] = ax + t * (b[0] - ax);
  out[1] = ay + t * (b[1] - ay);
  out[2] = az + t * (b[2] - az);
  return out;
}
/**
 * Performs a hermite interpolation with two control points
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @param {ReadonlyVec3} c the third operand
 * @param {ReadonlyVec3} d the fourth operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {vec3} out
 */

function hermite(out, a, b, c, d, t) {
  var factorTimes2 = t * t;
  var factor1 = factorTimes2 * (2 * t - 3) + 1;
  var factor2 = factorTimes2 * (t - 2) + t;
  var factor3 = factorTimes2 * (t - 1);
  var factor4 = factorTimes2 * (3 - 2 * t);
  out[0] = a[0] * factor1 + b[0] * factor2 + c[0] * factor3 + d[0] * factor4;
  out[1] = a[1] * factor1 + b[1] * factor2 + c[1] * factor3 + d[1] * factor4;
  out[2] = a[2] * factor1 + b[2] * factor2 + c[2] * factor3 + d[2] * factor4;
  return out;
}
/**
 * Performs a bezier interpolation with two control points
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @param {ReadonlyVec3} c the third operand
 * @param {ReadonlyVec3} d the fourth operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {vec3} out
 */

function bezier(out, a, b, c, d, t) {
  var inverseFactor = 1 - t;
  var inverseFactorTimesTwo = inverseFactor * inverseFactor;
  var factorTimes2 = t * t;
  var factor1 = inverseFactorTimesTwo * inverseFactor;
  var factor2 = 3 * t * inverseFactorTimesTwo;
  var factor3 = 3 * factorTimes2 * inverseFactor;
  var factor4 = factorTimes2 * t;
  out[0] = a[0] * factor1 + b[0] * factor2 + c[0] * factor3 + d[0] * factor4;
  out[1] = a[1] * factor1 + b[1] * factor2 + c[1] * factor3 + d[1] * factor4;
  out[2] = a[2] * factor1 + b[2] * factor2 + c[2] * factor3 + d[2] * factor4;
  return out;
}
/**
 * Generates a random vector with the given scale
 *
 * @param {vec3} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec3} out
 */

function random(out, scale) {
  scale = scale || 1.0;
  var r = RANDOM() * 2.0 * Math.PI;
  var z = RANDOM() * 2.0 - 1.0;
  var zScale = Math.sqrt(1.0 - z * z) * scale;
  out[0] = Math.cos(r) * zScale;
  out[1] = Math.sin(r) * zScale;
  out[2] = z * scale;
  return out;
}
/**
 * Transforms the vec3 with a mat4.
 * 4th vector component is implicitly '1'
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec3} out
 */

function transformMat4(out, a, m) {
  var x = a[0],
      y = a[1],
      z = a[2];
  var w = m[3] * x + m[7] * y + m[11] * z + m[15];
  w = w || 1.0;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
}
/**
 * Transforms the vec3 with a mat3.
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat3} m the 3x3 matrix to transform with
 * @returns {vec3} out
 */

function transformMat3(out, a, m) {
  var x = a[0],
      y = a[1],
      z = a[2];
  out[0] = x * m[0] + y * m[3] + z * m[6];
  out[1] = x * m[1] + y * m[4] + z * m[7];
  out[2] = x * m[2] + y * m[5] + z * m[8];
  return out;
}
/**
 * Transforms the vec3 with a quat
 * Can also be used for dual quaternions. (Multiply it with the real part)
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyQuat} q quaternion to transform with
 * @returns {vec3} out
 */

function transformQuat(out, a, q) {
  // benchmarks: https://jsperf.com/quaternion-transform-vec3-implementations-fixed
  var qx = q[0],
      qy = q[1],
      qz = q[2],
      qw = q[3];
  var x = a[0],
      y = a[1],
      z = a[2]; // var qvec = [qx, qy, qz];
  // var uv = vec3.cross([], qvec, a);

  var uvx = qy * z - qz * y,
      uvy = qz * x - qx * z,
      uvz = qx * y - qy * x; // var uuv = vec3.cross([], qvec, uv);

  var uuvx = qy * uvz - qz * uvy,
      uuvy = qz * uvx - qx * uvz,
      uuvz = qx * uvy - qy * uvx; // vec3.scale(uv, uv, 2 * w);

  var w2 = qw * 2;
  uvx *= w2;
  uvy *= w2;
  uvz *= w2; // vec3.scale(uuv, uuv, 2);

  uuvx *= 2;
  uuvy *= 2;
  uuvz *= 2; // return vec3.add(out, a, vec3.add(out, uv, uuv));

  out[0] = x + uvx + uuvx;
  out[1] = y + uvy + uuvy;
  out[2] = z + uvz + uuvz;
  return out;
}
/**
 * Rotate a 3D vector around the x-axis
 * @param {vec3} out The receiving vec3
 * @param {ReadonlyVec3} a The vec3 point to rotate
 * @param {ReadonlyVec3} b The origin of the rotation
 * @param {Number} rad The angle of rotation in radians
 * @returns {vec3} out
 */

function rotateX(out, a, b, rad) {
  var p = [],
      r = []; //Translate point to the origin

  p[0] = a[0] - b[0];
  p[1] = a[1] - b[1];
  p[2] = a[2] - b[2]; //perform rotation

  r[0] = p[0];
  r[1] = p[1] * Math.cos(rad) - p[2] * Math.sin(rad);
  r[2] = p[1] * Math.sin(rad) + p[2] * Math.cos(rad); //translate to correct position

  out[0] = r[0] + b[0];
  out[1] = r[1] + b[1];
  out[2] = r[2] + b[2];
  return out;
}
/**
 * Rotate a 3D vector around the y-axis
 * @param {vec3} out The receiving vec3
 * @param {ReadonlyVec3} a The vec3 point to rotate
 * @param {ReadonlyVec3} b The origin of the rotation
 * @param {Number} rad The angle of rotation in radians
 * @returns {vec3} out
 */

function rotateY(out, a, b, rad) {
  var p = [],
      r = []; //Translate point to the origin

  p[0] = a[0] - b[0];
  p[1] = a[1] - b[1];
  p[2] = a[2] - b[2]; //perform rotation

  r[0] = p[2] * Math.sin(rad) + p[0] * Math.cos(rad);
  r[1] = p[1];
  r[2] = p[2] * Math.cos(rad) - p[0] * Math.sin(rad); //translate to correct position

  out[0] = r[0] + b[0];
  out[1] = r[1] + b[1];
  out[2] = r[2] + b[2];
  return out;
}
/**
 * Rotate a 3D vector around the z-axis
 * @param {vec3} out The receiving vec3
 * @param {ReadonlyVec3} a The vec3 point to rotate
 * @param {ReadonlyVec3} b The origin of the rotation
 * @param {Number} rad The angle of rotation in radians
 * @returns {vec3} out
 */

function rotateZ(out, a, b, rad) {
  var p = [],
      r = []; //Translate point to the origin

  p[0] = a[0] - b[0];
  p[1] = a[1] - b[1];
  p[2] = a[2] - b[2]; //perform rotation

  r[0] = p[0] * Math.cos(rad) - p[1] * Math.sin(rad);
  r[1] = p[0] * Math.sin(rad) + p[1] * Math.cos(rad);
  r[2] = p[2]; //translate to correct position

  out[0] = r[0] + b[0];
  out[1] = r[1] + b[1];
  out[2] = r[2] + b[2];
  return out;
}
/**
 * Get the angle between two 3D vectors
 * @param {ReadonlyVec3} a The first operand
 * @param {ReadonlyVec3} b The second operand
 * @returns {Number} The angle in radians
 */

function angle(a, b) {
  var ax = a[0],
      ay = a[1],
      az = a[2],
      bx = b[0],
      by = b[1],
      bz = b[2],
      mag1 = Math.sqrt(ax * ax + ay * ay + az * az),
      mag2 = Math.sqrt(bx * bx + by * by + bz * bz),
      mag = mag1 * mag2,
      cosine = mag && dot(a, b) / mag;
  return Math.acos(Math.min(Math.max(cosine, -1), 1));
}
/**
 * Set the components of a vec3 to zero
 *
 * @param {vec3} out the receiving vector
 * @returns {vec3} out
 */

function zero(out) {
  out[0] = 0.0;
  out[1] = 0.0;
  out[2] = 0.0;
  return out;
}
/**
 * Returns a string representation of a vector
 *
 * @param {ReadonlyVec3} a vector to represent as a string
 * @returns {String} string representation of the vector
 */

function str(a) {
  return "vec3(" + a[0] + ", " + a[1] + ", " + a[2] + ")";
}
/**
 * Returns whether or not the vectors have exactly the same elements in the same position (when compared with ===)
 *
 * @param {ReadonlyVec3} a The first vector.
 * @param {ReadonlyVec3} b The second vector.
 * @returns {Boolean} True if the vectors are equal, false otherwise.
 */

function exactEquals(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
/**
 * Returns whether or not the vectors have approximately the same elements in the same position.
 *
 * @param {ReadonlyVec3} a The first vector.
 * @param {ReadonlyVec3} b The second vector.
 * @returns {Boolean} True if the vectors are equal, false otherwise.
 */

function equals(a, b) {
  var a0 = a[0],
      a1 = a[1],
      a2 = a[2];
  var b0 = b[0],
      b1 = b[1],
      b2 = b[2];
  return Math.abs(a0 - b0) <= EPSILON$1 * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON$1 * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON$1 * Math.max(1.0, Math.abs(a2), Math.abs(b2));
}
/**
 * Alias for {@link vec3.subtract}
 * @function
 */

var sub = subtract$1;
/**
 * Alias for {@link vec3.multiply}
 * @function
 */

var mul = multiply;
/**
 * Alias for {@link vec3.divide}
 * @function
 */

var div = divide;
/**
 * Alias for {@link vec3.distance}
 * @function
 */

var dist = distance;
/**
 * Alias for {@link vec3.squaredDistance}
 * @function
 */

var sqrDist = squaredDistance;
/**
 * Alias for {@link vec3.length}
 * @function
 */

var len = length;
/**
 * Alias for {@link vec3.squaredLength}
 * @function
 */

var sqrLen = squaredLength;
/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

var forEach = function () {
  var vec = create();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 3;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }

    return a;
  };
}();

var vec3 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	add: add,
	angle: angle,
	bezier: bezier,
	ceil: ceil,
	clone: clone,
	copy: copy,
	create: create,
	cross: cross$1,
	dist: dist,
	distance: distance,
	div: div,
	divide: divide,
	dot: dot,
	equals: equals,
	exactEquals: exactEquals,
	floor: floor,
	forEach: forEach,
	fromValues: fromValues,
	hermite: hermite,
	inverse: inverse,
	len: len,
	length: length,
	lerp: lerp,
	max: max,
	min: min,
	mul: mul,
	multiply: multiply,
	negate: negate,
	normalize: normalize$1,
	random: random,
	rotateX: rotateX,
	rotateY: rotateY,
	rotateZ: rotateZ,
	round: round,
	scale: scale,
	scaleAndAdd: scaleAndAdd,
	set: set,
	sqrDist: sqrDist,
	sqrLen: sqrLen,
	squaredDistance: squaredDistance,
	squaredLength: squaredLength,
	str: str,
	sub: sub,
	subtract: subtract$1,
	transformMat3: transformMat3,
	transformMat4: transformMat4,
	transformQuat: transformQuat,
	zero: zero
});

/**
 * Encodes a non-bitpacked frame which has one sample per pixel.
 *
 * @param {*} buffer
 * @param {*} numberOfFrames
 * @param {*} rows
 * @param {*} cols
 */

function encode(buffer, numberOfFrames, rows, cols) {
  var frameLength = rows * cols;
  var header = createHeader();
  var encodedFrames = [];

  for (var frame = 0; frame < numberOfFrames; frame++) {
    var frameOffset = frameLength * frame;
    encodedFrames.push(encodeFrame(buffer, frameOffset, rows, cols, header));
  }

  return encodedFrames;
}

function encodeFrame(buffer, frameOffset, rows, cols, header) {
  // Add header to frame:
  var rleArray = [];

  for (var r = 0; r < rows; r++) {
    var rowOffset = r * cols;
    var uint8Row = new Uint8Array(buffer, frameOffset + rowOffset, cols);
    var i = 0;

    while (i < uint8Row.length) {
      var literalRunLength = getLiteralRunLength(uint8Row, i);

      if (literalRunLength) {
        // State how many in litteral run
        rleArray.push(literalRunLength - 1); // Append litteral run.

        var literalRun = uint8Row.slice(i, i + literalRunLength);
        rleArray = [].concat(_toConsumableArray(rleArray), _toConsumableArray(literalRun));
        i += literalRunLength;
      }

      if (i >= uint8Row.length) {
        break;
      } // Next must be a replicate run.


      var replicateRunLength = getReplicateRunLength(uint8Row, i);

      if (replicateRunLength) {
        // State how many in replicate run
        rleArray.push(257 - replicateRunLength);
        rleArray.push(uint8Row[i]);
        i += replicateRunLength;
      }
    }
  }

  var headerLength = 64;
  var bodyLength = rleArray.length % 2 === 0 ? rleArray.length : rleArray.length + 1;
  var encodedFrameBuffer = new ArrayBuffer(headerLength + bodyLength); // Copy header into encodedFrameBuffer.

  var headerView = new Uint32Array(encodedFrameBuffer, 0, 16);

  for (var _i = 0; _i < headerView.length; _i++) {
    headerView[_i] = header[_i];
  }

  for (var _i2 = 0; _i2 < headerView.length; _i2++) {
    rleArray.push(headerView[_i2]);
  } // Copy rle data into encodedFrameBuffer.


  var bodyView = new Uint8Array(encodedFrameBuffer, 64);

  for (var _i3 = 0; _i3 < rleArray.length; _i3++) {
    bodyView[_i3] = rleArray[_i3];
  }

  return encodedFrameBuffer;
}

function createHeader() {
  var headerUint32 = new Uint32Array(16);
  headerUint32[0] = 1; // 1 Segment.

  headerUint32[1] = 64; // Data offset is 64 bytes.
  // Return byte-array version of header:

  return headerUint32;
}

function getLiteralRunLength(uint8Row, i) {
  for (var l = 0; l < uint8Row.length - i; l++) {
    if (uint8Row[i + l] === uint8Row[i + l + 1] && uint8Row[i + l + 1] === uint8Row[i + l + 2]) {
      return l;
    }

    if (l === 128) {
      return l;
    }
  }

  return uint8Row.length - i;
}

function getReplicateRunLength(uint8Row, i) {
  var first = uint8Row[i];

  for (var l = 1; l < uint8Row.length - i; l++) {
    if (uint8Row[i + l] !== first) {
      return l;
    }

    if (l === 128) {
      return l;
    }
  }

  return uint8Row.length - i;
}

function decode(rleEncodedFrames, rows, cols) {
  var pixelData = new Uint8Array(rows * cols * rleEncodedFrames.length);
  var buffer = pixelData.buffer;
  var frameLength = rows * cols;

  for (var i = 0; i < rleEncodedFrames.length; i++) {
    var rleEncodedFrame = rleEncodedFrames[i];
    var uint8FrameView = new Uint8Array(buffer, i * frameLength, frameLength);
    decodeFrame(rleEncodedFrame, uint8FrameView);
  }

  return pixelData;
}

function decodeFrame(rleEncodedFrame, pixelData) {
  // Check HEADER:
  var header = new Uint32Array(rleEncodedFrame, 0, 16);

  if (header[0] !== 1) {
    log.error("rleSingleSamplePerPixel only supports fragments with single Byte Segments (for rle encoded segmentation data) at the current time. This rleEncodedFrame has ".concat(header[0], " Byte Segments."));
    return;
  }

  if (header[1] !== 64) {
    log.error("Data offset of Byte Segment 1 should be 64 bytes, this rle fragment is encoded incorrectly.");
    return;
  }

  var uInt8Frame = new Uint8Array(rleEncodedFrame, 64);
  var pixelDataIndex = 0;
  var i = 0;

  while (pixelDataIndex < pixelData.length) {
    var byteValue = uInt8Frame[i];

    if (byteValue === undefined) {
      break;
    }

    if (byteValue <= 127) {
      // TODO -> Interpret the next N+1 bytes literally.
      var N = byteValue + 1;
      var next = i + 1; // Read the next N bytes literally.

      for (var p = next; p < next + N; p++) {
        pixelData[pixelDataIndex] = uInt8Frame[p];
        pixelDataIndex++;
      }

      i += N + 1;
    }

    if (byteValue >= 129) {
      var _N = 257 - byteValue;

      var _next = i + 1; // Repeat the next byte N times.


      for (var _p = 0; _p < _N; _p++) {
        pixelData[pixelDataIndex] = uInt8Frame[_next];
        pixelDataIndex++;
      }

      i += 2;
    }

    if (i === uInt8Frame.length) {
      break;
    }
  }
}

var compression = /*#__PURE__*/Object.freeze({
	__proto__: null,
	decode: decode,
	encode: encode
});

var lodash_clonedeep = {exports: {}};

/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */
lodash_clonedeep.exports;

(function (module, exports) {
	/** Used as the size to enable large array optimizations. */
	var LARGE_ARRAY_SIZE = 200;

	/** Used to stand-in for `undefined` hash values. */
	var HASH_UNDEFINED = '__lodash_hash_undefined__';

	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER = 9007199254740991;

	/** `Object#toString` result references. */
	var argsTag = '[object Arguments]',
	    arrayTag = '[object Array]',
	    boolTag = '[object Boolean]',
	    dateTag = '[object Date]',
	    errorTag = '[object Error]',
	    funcTag = '[object Function]',
	    genTag = '[object GeneratorFunction]',
	    mapTag = '[object Map]',
	    numberTag = '[object Number]',
	    objectTag = '[object Object]',
	    promiseTag = '[object Promise]',
	    regexpTag = '[object RegExp]',
	    setTag = '[object Set]',
	    stringTag = '[object String]',
	    symbolTag = '[object Symbol]',
	    weakMapTag = '[object WeakMap]';

	var arrayBufferTag = '[object ArrayBuffer]',
	    dataViewTag = '[object DataView]',
	    float32Tag = '[object Float32Array]',
	    float64Tag = '[object Float64Array]',
	    int8Tag = '[object Int8Array]',
	    int16Tag = '[object Int16Array]',
	    int32Tag = '[object Int32Array]',
	    uint8Tag = '[object Uint8Array]',
	    uint8ClampedTag = '[object Uint8ClampedArray]',
	    uint16Tag = '[object Uint16Array]',
	    uint32Tag = '[object Uint32Array]';

	/**
	 * Used to match `RegExp`
	 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
	 */
	var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

	/** Used to match `RegExp` flags from their coerced string values. */
	var reFlags = /\w*$/;

	/** Used to detect host constructors (Safari). */
	var reIsHostCtor = /^\[object .+?Constructor\]$/;

	/** Used to detect unsigned integer values. */
	var reIsUint = /^(?:0|[1-9]\d*)$/;

	/** Used to identify `toStringTag` values supported by `_.clone`. */
	var cloneableTags = {};
	cloneableTags[argsTag] = cloneableTags[arrayTag] =
	cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] =
	cloneableTags[boolTag] = cloneableTags[dateTag] =
	cloneableTags[float32Tag] = cloneableTags[float64Tag] =
	cloneableTags[int8Tag] = cloneableTags[int16Tag] =
	cloneableTags[int32Tag] = cloneableTags[mapTag] =
	cloneableTags[numberTag] = cloneableTags[objectTag] =
	cloneableTags[regexpTag] = cloneableTags[setTag] =
	cloneableTags[stringTag] = cloneableTags[symbolTag] =
	cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] =
	cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
	cloneableTags[errorTag] = cloneableTags[funcTag] =
	cloneableTags[weakMapTag] = false;

	/** Detect free variable `global` from Node.js. */
	var freeGlobal = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

	/** Detect free variable `self`. */
	var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

	/** Used as a reference to the global object. */
	var root = freeGlobal || freeSelf || Function('return this')();

	/** Detect free variable `exports`. */
	var freeExports = exports && !exports.nodeType && exports;

	/** Detect free variable `module`. */
	var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;

	/** Detect the popular CommonJS extension `module.exports`. */
	var moduleExports = freeModule && freeModule.exports === freeExports;

	/**
	 * Adds the key-value `pair` to `map`.
	 *
	 * @private
	 * @param {Object} map The map to modify.
	 * @param {Array} pair The key-value pair to add.
	 * @returns {Object} Returns `map`.
	 */
	function addMapEntry(map, pair) {
	  // Don't return `map.set` because it's not chainable in IE 11.
	  map.set(pair[0], pair[1]);
	  return map;
	}

	/**
	 * Adds `value` to `set`.
	 *
	 * @private
	 * @param {Object} set The set to modify.
	 * @param {*} value The value to add.
	 * @returns {Object} Returns `set`.
	 */
	function addSetEntry(set, value) {
	  // Don't return `set.add` because it's not chainable in IE 11.
	  set.add(value);
	  return set;
	}

	/**
	 * A specialized version of `_.forEach` for arrays without support for
	 * iteratee shorthands.
	 *
	 * @private
	 * @param {Array} [array] The array to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Array} Returns `array`.
	 */
	function arrayEach(array, iteratee) {
	  var index = -1,
	      length = array ? array.length : 0;

	  while (++index < length) {
	    if (iteratee(array[index], index, array) === false) {
	      break;
	    }
	  }
	  return array;
	}

	/**
	 * Appends the elements of `values` to `array`.
	 *
	 * @private
	 * @param {Array} array The array to modify.
	 * @param {Array} values The values to append.
	 * @returns {Array} Returns `array`.
	 */
	function arrayPush(array, values) {
	  var index = -1,
	      length = values.length,
	      offset = array.length;

	  while (++index < length) {
	    array[offset + index] = values[index];
	  }
	  return array;
	}

	/**
	 * A specialized version of `_.reduce` for arrays without support for
	 * iteratee shorthands.
	 *
	 * @private
	 * @param {Array} [array] The array to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @param {*} [accumulator] The initial value.
	 * @param {boolean} [initAccum] Specify using the first element of `array` as
	 *  the initial value.
	 * @returns {*} Returns the accumulated value.
	 */
	function arrayReduce(array, iteratee, accumulator, initAccum) {
	  var index = -1,
	      length = array ? array.length : 0;

	  if (initAccum && length) {
	    accumulator = array[++index];
	  }
	  while (++index < length) {
	    accumulator = iteratee(accumulator, array[index], index, array);
	  }
	  return accumulator;
	}

	/**
	 * The base implementation of `_.times` without support for iteratee shorthands
	 * or max array length checks.
	 *
	 * @private
	 * @param {number} n The number of times to invoke `iteratee`.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Array} Returns the array of results.
	 */
	function baseTimes(n, iteratee) {
	  var index = -1,
	      result = Array(n);

	  while (++index < n) {
	    result[index] = iteratee(index);
	  }
	  return result;
	}

	/**
	 * Gets the value at `key` of `object`.
	 *
	 * @private
	 * @param {Object} [object] The object to query.
	 * @param {string} key The key of the property to get.
	 * @returns {*} Returns the property value.
	 */
	function getValue(object, key) {
	  return object == null ? undefined : object[key];
	}

	/**
	 * Checks if `value` is a host object in IE < 9.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
	 */
	function isHostObject(value) {
	  // Many host objects are `Object` objects that can coerce to strings
	  // despite having improperly defined `toString` methods.
	  var result = false;
	  if (value != null && typeof value.toString != 'function') {
	    try {
	      result = !!(value + '');
	    } catch (e) {}
	  }
	  return result;
	}

	/**
	 * Converts `map` to its key-value pairs.
	 *
	 * @private
	 * @param {Object} map The map to convert.
	 * @returns {Array} Returns the key-value pairs.
	 */
	function mapToArray(map) {
	  var index = -1,
	      result = Array(map.size);

	  map.forEach(function(value, key) {
	    result[++index] = [key, value];
	  });
	  return result;
	}

	/**
	 * Creates a unary function that invokes `func` with its argument transformed.
	 *
	 * @private
	 * @param {Function} func The function to wrap.
	 * @param {Function} transform The argument transform.
	 * @returns {Function} Returns the new function.
	 */
	function overArg(func, transform) {
	  return function(arg) {
	    return func(transform(arg));
	  };
	}

	/**
	 * Converts `set` to an array of its values.
	 *
	 * @private
	 * @param {Object} set The set to convert.
	 * @returns {Array} Returns the values.
	 */
	function setToArray(set) {
	  var index = -1,
	      result = Array(set.size);

	  set.forEach(function(value) {
	    result[++index] = value;
	  });
	  return result;
	}

	/** Used for built-in method references. */
	var arrayProto = Array.prototype,
	    funcProto = Function.prototype,
	    objectProto = Object.prototype;

	/** Used to detect overreaching core-js shims. */
	var coreJsData = root['__core-js_shared__'];

	/** Used to detect methods masquerading as native. */
	var maskSrcKey = (function() {
	  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
	  return uid ? ('Symbol(src)_1.' + uid) : '';
	}());

	/** Used to resolve the decompiled source of functions. */
	var funcToString = funcProto.toString;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;

	/** Used to detect if a method is native. */
	var reIsNative = RegExp('^' +
	  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
	  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
	);

	/** Built-in value references. */
	var Buffer = moduleExports ? root.Buffer : undefined,
	    Symbol = root.Symbol,
	    Uint8Array = root.Uint8Array,
	    getPrototype = overArg(Object.getPrototypeOf, Object),
	    objectCreate = Object.create,
	    propertyIsEnumerable = objectProto.propertyIsEnumerable,
	    splice = arrayProto.splice;

	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeGetSymbols = Object.getOwnPropertySymbols,
	    nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined,
	    nativeKeys = overArg(Object.keys, Object);

	/* Built-in method references that are verified to be native. */
	var DataView = getNative(root, 'DataView'),
	    Map = getNative(root, 'Map'),
	    Promise = getNative(root, 'Promise'),
	    Set = getNative(root, 'Set'),
	    WeakMap = getNative(root, 'WeakMap'),
	    nativeCreate = getNative(Object, 'create');

	/** Used to detect maps, sets, and weakmaps. */
	var dataViewCtorString = toSource(DataView),
	    mapCtorString = toSource(Map),
	    promiseCtorString = toSource(Promise),
	    setCtorString = toSource(Set),
	    weakMapCtorString = toSource(WeakMap);

	/** Used to convert symbols to primitives and strings. */
	var symbolProto = Symbol ? Symbol.prototype : undefined,
	    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

	/**
	 * Creates a hash object.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function Hash(entries) {
	  var index = -1,
	      length = entries ? entries.length : 0;

	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}

	/**
	 * Removes all key-value entries from the hash.
	 *
	 * @private
	 * @name clear
	 * @memberOf Hash
	 */
	function hashClear() {
	  this.__data__ = nativeCreate ? nativeCreate(null) : {};
	}

	/**
	 * Removes `key` and its value from the hash.
	 *
	 * @private
	 * @name delete
	 * @memberOf Hash
	 * @param {Object} hash The hash to modify.
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function hashDelete(key) {
	  return this.has(key) && delete this.__data__[key];
	}

	/**
	 * Gets the hash value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf Hash
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function hashGet(key) {
	  var data = this.__data__;
	  if (nativeCreate) {
	    var result = data[key];
	    return result === HASH_UNDEFINED ? undefined : result;
	  }
	  return hasOwnProperty.call(data, key) ? data[key] : undefined;
	}

	/**
	 * Checks if a hash value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf Hash
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function hashHas(key) {
	  var data = this.__data__;
	  return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
	}

	/**
	 * Sets the hash `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf Hash
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the hash instance.
	 */
	function hashSet(key, value) {
	  var data = this.__data__;
	  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
	  return this;
	}

	// Add methods to `Hash`.
	Hash.prototype.clear = hashClear;
	Hash.prototype['delete'] = hashDelete;
	Hash.prototype.get = hashGet;
	Hash.prototype.has = hashHas;
	Hash.prototype.set = hashSet;

	/**
	 * Creates an list cache object.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function ListCache(entries) {
	  var index = -1,
	      length = entries ? entries.length : 0;

	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}

	/**
	 * Removes all key-value entries from the list cache.
	 *
	 * @private
	 * @name clear
	 * @memberOf ListCache
	 */
	function listCacheClear() {
	  this.__data__ = [];
	}

	/**
	 * Removes `key` and its value from the list cache.
	 *
	 * @private
	 * @name delete
	 * @memberOf ListCache
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function listCacheDelete(key) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);

	  if (index < 0) {
	    return false;
	  }
	  var lastIndex = data.length - 1;
	  if (index == lastIndex) {
	    data.pop();
	  } else {
	    splice.call(data, index, 1);
	  }
	  return true;
	}

	/**
	 * Gets the list cache value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf ListCache
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function listCacheGet(key) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);

	  return index < 0 ? undefined : data[index][1];
	}

	/**
	 * Checks if a list cache value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf ListCache
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function listCacheHas(key) {
	  return assocIndexOf(this.__data__, key) > -1;
	}

	/**
	 * Sets the list cache `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf ListCache
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the list cache instance.
	 */
	function listCacheSet(key, value) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);

	  if (index < 0) {
	    data.push([key, value]);
	  } else {
	    data[index][1] = value;
	  }
	  return this;
	}

	// Add methods to `ListCache`.
	ListCache.prototype.clear = listCacheClear;
	ListCache.prototype['delete'] = listCacheDelete;
	ListCache.prototype.get = listCacheGet;
	ListCache.prototype.has = listCacheHas;
	ListCache.prototype.set = listCacheSet;

	/**
	 * Creates a map cache object to store key-value pairs.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function MapCache(entries) {
	  var index = -1,
	      length = entries ? entries.length : 0;

	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}

	/**
	 * Removes all key-value entries from the map.
	 *
	 * @private
	 * @name clear
	 * @memberOf MapCache
	 */
	function mapCacheClear() {
	  this.__data__ = {
	    'hash': new Hash,
	    'map': new (Map || ListCache),
	    'string': new Hash
	  };
	}

	/**
	 * Removes `key` and its value from the map.
	 *
	 * @private
	 * @name delete
	 * @memberOf MapCache
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function mapCacheDelete(key) {
	  return getMapData(this, key)['delete'](key);
	}

	/**
	 * Gets the map value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf MapCache
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function mapCacheGet(key) {
	  return getMapData(this, key).get(key);
	}

	/**
	 * Checks if a map value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf MapCache
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function mapCacheHas(key) {
	  return getMapData(this, key).has(key);
	}

	/**
	 * Sets the map `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf MapCache
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the map cache instance.
	 */
	function mapCacheSet(key, value) {
	  getMapData(this, key).set(key, value);
	  return this;
	}

	// Add methods to `MapCache`.
	MapCache.prototype.clear = mapCacheClear;
	MapCache.prototype['delete'] = mapCacheDelete;
	MapCache.prototype.get = mapCacheGet;
	MapCache.prototype.has = mapCacheHas;
	MapCache.prototype.set = mapCacheSet;

	/**
	 * Creates a stack cache object to store key-value pairs.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function Stack(entries) {
	  this.__data__ = new ListCache(entries);
	}

	/**
	 * Removes all key-value entries from the stack.
	 *
	 * @private
	 * @name clear
	 * @memberOf Stack
	 */
	function stackClear() {
	  this.__data__ = new ListCache;
	}

	/**
	 * Removes `key` and its value from the stack.
	 *
	 * @private
	 * @name delete
	 * @memberOf Stack
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function stackDelete(key) {
	  return this.__data__['delete'](key);
	}

	/**
	 * Gets the stack value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf Stack
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function stackGet(key) {
	  return this.__data__.get(key);
	}

	/**
	 * Checks if a stack value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf Stack
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function stackHas(key) {
	  return this.__data__.has(key);
	}

	/**
	 * Sets the stack `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf Stack
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the stack cache instance.
	 */
	function stackSet(key, value) {
	  var cache = this.__data__;
	  if (cache instanceof ListCache) {
	    var pairs = cache.__data__;
	    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
	      pairs.push([key, value]);
	      return this;
	    }
	    cache = this.__data__ = new MapCache(pairs);
	  }
	  cache.set(key, value);
	  return this;
	}

	// Add methods to `Stack`.
	Stack.prototype.clear = stackClear;
	Stack.prototype['delete'] = stackDelete;
	Stack.prototype.get = stackGet;
	Stack.prototype.has = stackHas;
	Stack.prototype.set = stackSet;

	/**
	 * Creates an array of the enumerable property names of the array-like `value`.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @param {boolean} inherited Specify returning inherited property names.
	 * @returns {Array} Returns the array of property names.
	 */
	function arrayLikeKeys(value, inherited) {
	  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
	  // Safari 9 makes `arguments.length` enumerable in strict mode.
	  var result = (isArray(value) || isArguments(value))
	    ? baseTimes(value.length, String)
	    : [];

	  var length = result.length,
	      skipIndexes = !!length;

	  for (var key in value) {
	    if ((inherited || hasOwnProperty.call(value, key)) &&
	        !(skipIndexes && (key == 'length' || isIndex(key, length)))) {
	      result.push(key);
	    }
	  }
	  return result;
	}

	/**
	 * Assigns `value` to `key` of `object` if the existing value is not equivalent
	 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	 * for equality comparisons.
	 *
	 * @private
	 * @param {Object} object The object to modify.
	 * @param {string} key The key of the property to assign.
	 * @param {*} value The value to assign.
	 */
	function assignValue(object, key, value) {
	  var objValue = object[key];
	  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
	      (value === undefined && !(key in object))) {
	    object[key] = value;
	  }
	}

	/**
	 * Gets the index at which the `key` is found in `array` of key-value pairs.
	 *
	 * @private
	 * @param {Array} array The array to inspect.
	 * @param {*} key The key to search for.
	 * @returns {number} Returns the index of the matched value, else `-1`.
	 */
	function assocIndexOf(array, key) {
	  var length = array.length;
	  while (length--) {
	    if (eq(array[length][0], key)) {
	      return length;
	    }
	  }
	  return -1;
	}

	/**
	 * The base implementation of `_.assign` without support for multiple sources
	 * or `customizer` functions.
	 *
	 * @private
	 * @param {Object} object The destination object.
	 * @param {Object} source The source object.
	 * @returns {Object} Returns `object`.
	 */
	function baseAssign(object, source) {
	  return object && copyObject(source, keys(source), object);
	}

	/**
	 * The base implementation of `_.clone` and `_.cloneDeep` which tracks
	 * traversed objects.
	 *
	 * @private
	 * @param {*} value The value to clone.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @param {boolean} [isFull] Specify a clone including symbols.
	 * @param {Function} [customizer] The function to customize cloning.
	 * @param {string} [key] The key of `value`.
	 * @param {Object} [object] The parent object of `value`.
	 * @param {Object} [stack] Tracks traversed objects and their clone counterparts.
	 * @returns {*} Returns the cloned value.
	 */
	function baseClone(value, isDeep, isFull, customizer, key, object, stack) {
	  var result;
	  if (customizer) {
	    result = object ? customizer(value, key, object, stack) : customizer(value);
	  }
	  if (result !== undefined) {
	    return result;
	  }
	  if (!isObject(value)) {
	    return value;
	  }
	  var isArr = isArray(value);
	  if (isArr) {
	    result = initCloneArray(value);
	    if (!isDeep) {
	      return copyArray(value, result);
	    }
	  } else {
	    var tag = getTag(value),
	        isFunc = tag == funcTag || tag == genTag;

	    if (isBuffer(value)) {
	      return cloneBuffer(value, isDeep);
	    }
	    if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
	      if (isHostObject(value)) {
	        return object ? value : {};
	      }
	      result = initCloneObject(isFunc ? {} : value);
	      if (!isDeep) {
	        return copySymbols(value, baseAssign(result, value));
	      }
	    } else {
	      if (!cloneableTags[tag]) {
	        return object ? value : {};
	      }
	      result = initCloneByTag(value, tag, baseClone, isDeep);
	    }
	  }
	  // Check for circular references and return its corresponding clone.
	  stack || (stack = new Stack);
	  var stacked = stack.get(value);
	  if (stacked) {
	    return stacked;
	  }
	  stack.set(value, result);

	  if (!isArr) {
	    var props = isFull ? getAllKeys(value) : keys(value);
	  }
	  arrayEach(props || value, function(subValue, key) {
	    if (props) {
	      key = subValue;
	      subValue = value[key];
	    }
	    // Recursively populate clone (susceptible to call stack limits).
	    assignValue(result, key, baseClone(subValue, isDeep, isFull, customizer, key, value, stack));
	  });
	  return result;
	}

	/**
	 * The base implementation of `_.create` without support for assigning
	 * properties to the created object.
	 *
	 * @private
	 * @param {Object} prototype The object to inherit from.
	 * @returns {Object} Returns the new object.
	 */
	function baseCreate(proto) {
	  return isObject(proto) ? objectCreate(proto) : {};
	}

	/**
	 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
	 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
	 * symbols of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {Function} keysFunc The function to get the keys of `object`.
	 * @param {Function} symbolsFunc The function to get the symbols of `object`.
	 * @returns {Array} Returns the array of property names and symbols.
	 */
	function baseGetAllKeys(object, keysFunc, symbolsFunc) {
	  var result = keysFunc(object);
	  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
	}

	/**
	 * The base implementation of `getTag`.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the `toStringTag`.
	 */
	function baseGetTag(value) {
	  return objectToString.call(value);
	}

	/**
	 * The base implementation of `_.isNative` without bad shim checks.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a native function,
	 *  else `false`.
	 */
	function baseIsNative(value) {
	  if (!isObject(value) || isMasked(value)) {
	    return false;
	  }
	  var pattern = (isFunction(value) || isHostObject(value)) ? reIsNative : reIsHostCtor;
	  return pattern.test(toSource(value));
	}

	/**
	 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 */
	function baseKeys(object) {
	  if (!isPrototype(object)) {
	    return nativeKeys(object);
	  }
	  var result = [];
	  for (var key in Object(object)) {
	    if (hasOwnProperty.call(object, key) && key != 'constructor') {
	      result.push(key);
	    }
	  }
	  return result;
	}

	/**
	 * Creates a clone of  `buffer`.
	 *
	 * @private
	 * @param {Buffer} buffer The buffer to clone.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Buffer} Returns the cloned buffer.
	 */
	function cloneBuffer(buffer, isDeep) {
	  if (isDeep) {
	    return buffer.slice();
	  }
	  var result = new buffer.constructor(buffer.length);
	  buffer.copy(result);
	  return result;
	}

	/**
	 * Creates a clone of `arrayBuffer`.
	 *
	 * @private
	 * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
	 * @returns {ArrayBuffer} Returns the cloned array buffer.
	 */
	function cloneArrayBuffer(arrayBuffer) {
	  var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
	  new Uint8Array(result).set(new Uint8Array(arrayBuffer));
	  return result;
	}

	/**
	 * Creates a clone of `dataView`.
	 *
	 * @private
	 * @param {Object} dataView The data view to clone.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the cloned data view.
	 */
	function cloneDataView(dataView, isDeep) {
	  var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
	  return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
	}

	/**
	 * Creates a clone of `map`.
	 *
	 * @private
	 * @param {Object} map The map to clone.
	 * @param {Function} cloneFunc The function to clone values.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the cloned map.
	 */
	function cloneMap(map, isDeep, cloneFunc) {
	  var array = isDeep ? cloneFunc(mapToArray(map), true) : mapToArray(map);
	  return arrayReduce(array, addMapEntry, new map.constructor);
	}

	/**
	 * Creates a clone of `regexp`.
	 *
	 * @private
	 * @param {Object} regexp The regexp to clone.
	 * @returns {Object} Returns the cloned regexp.
	 */
	function cloneRegExp(regexp) {
	  var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
	  result.lastIndex = regexp.lastIndex;
	  return result;
	}

	/**
	 * Creates a clone of `set`.
	 *
	 * @private
	 * @param {Object} set The set to clone.
	 * @param {Function} cloneFunc The function to clone values.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the cloned set.
	 */
	function cloneSet(set, isDeep, cloneFunc) {
	  var array = isDeep ? cloneFunc(setToArray(set), true) : setToArray(set);
	  return arrayReduce(array, addSetEntry, new set.constructor);
	}

	/**
	 * Creates a clone of the `symbol` object.
	 *
	 * @private
	 * @param {Object} symbol The symbol object to clone.
	 * @returns {Object} Returns the cloned symbol object.
	 */
	function cloneSymbol(symbol) {
	  return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
	}

	/**
	 * Creates a clone of `typedArray`.
	 *
	 * @private
	 * @param {Object} typedArray The typed array to clone.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the cloned typed array.
	 */
	function cloneTypedArray(typedArray, isDeep) {
	  var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
	  return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
	}

	/**
	 * Copies the values of `source` to `array`.
	 *
	 * @private
	 * @param {Array} source The array to copy values from.
	 * @param {Array} [array=[]] The array to copy values to.
	 * @returns {Array} Returns `array`.
	 */
	function copyArray(source, array) {
	  var index = -1,
	      length = source.length;

	  array || (array = Array(length));
	  while (++index < length) {
	    array[index] = source[index];
	  }
	  return array;
	}

	/**
	 * Copies properties of `source` to `object`.
	 *
	 * @private
	 * @param {Object} source The object to copy properties from.
	 * @param {Array} props The property identifiers to copy.
	 * @param {Object} [object={}] The object to copy properties to.
	 * @param {Function} [customizer] The function to customize copied values.
	 * @returns {Object} Returns `object`.
	 */
	function copyObject(source, props, object, customizer) {
	  object || (object = {});

	  var index = -1,
	      length = props.length;

	  while (++index < length) {
	    var key = props[index];

	    var newValue = customizer
	      ? customizer(object[key], source[key], key, object, source)
	      : undefined;

	    assignValue(object, key, newValue === undefined ? source[key] : newValue);
	  }
	  return object;
	}

	/**
	 * Copies own symbol properties of `source` to `object`.
	 *
	 * @private
	 * @param {Object} source The object to copy symbols from.
	 * @param {Object} [object={}] The object to copy symbols to.
	 * @returns {Object} Returns `object`.
	 */
	function copySymbols(source, object) {
	  return copyObject(source, getSymbols(source), object);
	}

	/**
	 * Creates an array of own enumerable property names and symbols of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names and symbols.
	 */
	function getAllKeys(object) {
	  return baseGetAllKeys(object, keys, getSymbols);
	}

	/**
	 * Gets the data for `map`.
	 *
	 * @private
	 * @param {Object} map The map to query.
	 * @param {string} key The reference key.
	 * @returns {*} Returns the map data.
	 */
	function getMapData(map, key) {
	  var data = map.__data__;
	  return isKeyable(key)
	    ? data[typeof key == 'string' ? 'string' : 'hash']
	    : data.map;
	}

	/**
	 * Gets the native function at `key` of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {string} key The key of the method to get.
	 * @returns {*} Returns the function if it's native, else `undefined`.
	 */
	function getNative(object, key) {
	  var value = getValue(object, key);
	  return baseIsNative(value) ? value : undefined;
	}

	/**
	 * Creates an array of the own enumerable symbol properties of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of symbols.
	 */
	var getSymbols = nativeGetSymbols ? overArg(nativeGetSymbols, Object) : stubArray;

	/**
	 * Gets the `toStringTag` of `value`.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the `toStringTag`.
	 */
	var getTag = baseGetTag;

	// Fallback for data views, maps, sets, and weak maps in IE 11,
	// for data views in Edge < 14, and promises in Node.js.
	if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
	    (Map && getTag(new Map) != mapTag) ||
	    (Promise && getTag(Promise.resolve()) != promiseTag) ||
	    (Set && getTag(new Set) != setTag) ||
	    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
	  getTag = function(value) {
	    var result = objectToString.call(value),
	        Ctor = result == objectTag ? value.constructor : undefined,
	        ctorString = Ctor ? toSource(Ctor) : undefined;

	    if (ctorString) {
	      switch (ctorString) {
	        case dataViewCtorString: return dataViewTag;
	        case mapCtorString: return mapTag;
	        case promiseCtorString: return promiseTag;
	        case setCtorString: return setTag;
	        case weakMapCtorString: return weakMapTag;
	      }
	    }
	    return result;
	  };
	}

	/**
	 * Initializes an array clone.
	 *
	 * @private
	 * @param {Array} array The array to clone.
	 * @returns {Array} Returns the initialized clone.
	 */
	function initCloneArray(array) {
	  var length = array.length,
	      result = array.constructor(length);

	  // Add properties assigned by `RegExp#exec`.
	  if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
	    result.index = array.index;
	    result.input = array.input;
	  }
	  return result;
	}

	/**
	 * Initializes an object clone.
	 *
	 * @private
	 * @param {Object} object The object to clone.
	 * @returns {Object} Returns the initialized clone.
	 */
	function initCloneObject(object) {
	  return (typeof object.constructor == 'function' && !isPrototype(object))
	    ? baseCreate(getPrototype(object))
	    : {};
	}

	/**
	 * Initializes an object clone based on its `toStringTag`.
	 *
	 * **Note:** This function only supports cloning values with tags of
	 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
	 *
	 * @private
	 * @param {Object} object The object to clone.
	 * @param {string} tag The `toStringTag` of the object to clone.
	 * @param {Function} cloneFunc The function to clone values.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the initialized clone.
	 */
	function initCloneByTag(object, tag, cloneFunc, isDeep) {
	  var Ctor = object.constructor;
	  switch (tag) {
	    case arrayBufferTag:
	      return cloneArrayBuffer(object);

	    case boolTag:
	    case dateTag:
	      return new Ctor(+object);

	    case dataViewTag:
	      return cloneDataView(object, isDeep);

	    case float32Tag: case float64Tag:
	    case int8Tag: case int16Tag: case int32Tag:
	    case uint8Tag: case uint8ClampedTag: case uint16Tag: case uint32Tag:
	      return cloneTypedArray(object, isDeep);

	    case mapTag:
	      return cloneMap(object, isDeep, cloneFunc);

	    case numberTag:
	    case stringTag:
	      return new Ctor(object);

	    case regexpTag:
	      return cloneRegExp(object);

	    case setTag:
	      return cloneSet(object, isDeep, cloneFunc);

	    case symbolTag:
	      return cloneSymbol(object);
	  }
	}

	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  length = length == null ? MAX_SAFE_INTEGER : length;
	  return !!length &&
	    (typeof value == 'number' || reIsUint.test(value)) &&
	    (value > -1 && value % 1 == 0 && value < length);
	}

	/**
	 * Checks if `value` is suitable for use as unique object key.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
	 */
	function isKeyable(value) {
	  var type = typeof value;
	  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
	    ? (value !== '__proto__')
	    : (value === null);
	}

	/**
	 * Checks if `func` has its source masked.
	 *
	 * @private
	 * @param {Function} func The function to check.
	 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
	 */
	function isMasked(func) {
	  return !!maskSrcKey && (maskSrcKey in func);
	}

	/**
	 * Checks if `value` is likely a prototype object.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
	 */
	function isPrototype(value) {
	  var Ctor = value && value.constructor,
	      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

	  return value === proto;
	}

	/**
	 * Converts `func` to its source code.
	 *
	 * @private
	 * @param {Function} func The function to process.
	 * @returns {string} Returns the source code.
	 */
	function toSource(func) {
	  if (func != null) {
	    try {
	      return funcToString.call(func);
	    } catch (e) {}
	    try {
	      return (func + '');
	    } catch (e) {}
	  }
	  return '';
	}

	/**
	 * This method is like `_.clone` except that it recursively clones `value`.
	 *
	 * @static
	 * @memberOf _
	 * @since 1.0.0
	 * @category Lang
	 * @param {*} value The value to recursively clone.
	 * @returns {*} Returns the deep cloned value.
	 * @see _.clone
	 * @example
	 *
	 * var objects = [{ 'a': 1 }, { 'b': 2 }];
	 *
	 * var deep = _.cloneDeep(objects);
	 * console.log(deep[0] === objects[0]);
	 * // => false
	 */
	function cloneDeep(value) {
	  return baseClone(value, true, true);
	}

	/**
	 * Performs a
	 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	 * comparison between two values to determine if they are equivalent.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	 * @example
	 *
	 * var object = { 'a': 1 };
	 * var other = { 'a': 1 };
	 *
	 * _.eq(object, object);
	 * // => true
	 *
	 * _.eq(object, other);
	 * // => false
	 *
	 * _.eq('a', 'a');
	 * // => true
	 *
	 * _.eq('a', Object('a'));
	 * // => false
	 *
	 * _.eq(NaN, NaN);
	 * // => true
	 */
	function eq(value, other) {
	  return value === other || (value !== value && other !== other);
	}

	/**
	 * Checks if `value` is likely an `arguments` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
	 *  else `false`.
	 * @example
	 *
	 * _.isArguments(function() { return arguments; }());
	 * // => true
	 *
	 * _.isArguments([1, 2, 3]);
	 * // => false
	 */
	function isArguments(value) {
	  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
	  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
	    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
	}

	/**
	 * Checks if `value` is classified as an `Array` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
	 * @example
	 *
	 * _.isArray([1, 2, 3]);
	 * // => true
	 *
	 * _.isArray(document.body.children);
	 * // => false
	 *
	 * _.isArray('abc');
	 * // => false
	 *
	 * _.isArray(_.noop);
	 * // => false
	 */
	var isArray = Array.isArray;

	/**
	 * Checks if `value` is array-like. A value is considered array-like if it's
	 * not a function and has a `value.length` that's an integer greater than or
	 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 * @example
	 *
	 * _.isArrayLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLike(document.body.children);
	 * // => true
	 *
	 * _.isArrayLike('abc');
	 * // => true
	 *
	 * _.isArrayLike(_.noop);
	 * // => false
	 */
	function isArrayLike(value) {
	  return value != null && isLength(value.length) && !isFunction(value);
	}

	/**
	 * This method is like `_.isArrayLike` except that it also checks if `value`
	 * is an object.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an array-like object,
	 *  else `false`.
	 * @example
	 *
	 * _.isArrayLikeObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLikeObject(document.body.children);
	 * // => true
	 *
	 * _.isArrayLikeObject('abc');
	 * // => false
	 *
	 * _.isArrayLikeObject(_.noop);
	 * // => false
	 */
	function isArrayLikeObject(value) {
	  return isObjectLike(value) && isArrayLike(value);
	}

	/**
	 * Checks if `value` is a buffer.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.3.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
	 * @example
	 *
	 * _.isBuffer(new Buffer(2));
	 * // => true
	 *
	 * _.isBuffer(new Uint8Array(2));
	 * // => false
	 */
	var isBuffer = nativeIsBuffer || stubFalse;

	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in Safari 8-9 which returns 'object' for typed array and other constructors.
	  var tag = isObject(value) ? objectToString.call(value) : '';
	  return tag == funcTag || tag == genTag;
	}

	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This method is loosely based on
	 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 * @example
	 *
	 * _.isLength(3);
	 * // => true
	 *
	 * _.isLength(Number.MIN_VALUE);
	 * // => false
	 *
	 * _.isLength(Infinity);
	 * // => false
	 *
	 * _.isLength('3');
	 * // => false
	 */
	function isLength(value) {
	  return typeof value == 'number' &&
	    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}

	/**
	 * Checks if `value` is the
	 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */
	function isObject(value) {
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}

	/**
	 * Checks if `value` is object-like. A value is object-like if it's not `null`
	 * and has a `typeof` result of "object".
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 * @example
	 *
	 * _.isObjectLike({});
	 * // => true
	 *
	 * _.isObjectLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isObjectLike(_.noop);
	 * // => false
	 *
	 * _.isObjectLike(null);
	 * // => false
	 */
	function isObjectLike(value) {
	  return !!value && typeof value == 'object';
	}

	/**
	 * Creates an array of the own enumerable property names of `object`.
	 *
	 * **Note:** Non-object values are coerced to objects. See the
	 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
	 * for more details.
	 *
	 * @static
	 * @since 0.1.0
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 *   this.b = 2;
	 * }
	 *
	 * Foo.prototype.c = 3;
	 *
	 * _.keys(new Foo);
	 * // => ['a', 'b'] (iteration order is not guaranteed)
	 *
	 * _.keys('hi');
	 * // => ['0', '1']
	 */
	function keys(object) {
	  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
	}

	/**
	 * This method returns a new empty array.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.13.0
	 * @category Util
	 * @returns {Array} Returns the new empty array.
	 * @example
	 *
	 * var arrays = _.times(2, _.stubArray);
	 *
	 * console.log(arrays);
	 * // => [[], []]
	 *
	 * console.log(arrays[0] === arrays[1]);
	 * // => false
	 */
	function stubArray() {
	  return [];
	}

	/**
	 * This method returns `false`.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.13.0
	 * @category Util
	 * @returns {boolean} Returns `false`.
	 * @example
	 *
	 * _.times(2, _.stubFalse);
	 * // => [false, false]
	 */
	function stubFalse() {
	  return false;
	}

	module.exports = cloneDeep; 
} (lodash_clonedeep, lodash_clonedeep.exports));

var lodash_clonedeepExports = lodash_clonedeep.exports;
var cloneDeep = /*@__PURE__*/getDefaultExportFromCjs(lodash_clonedeepExports);

var Segmentation$2 = {
  generateSegmentation: generateSegmentation$1,
  generateToolState: generateToolState$1,
  fillSegmentation: fillSegmentation$1
};
/**
 *
 * @typedef {Object} BrushData
 * @property {Object} toolState - The cornerstoneTools global toolState.
 * @property {Object[]} segments - The cornerstoneTools segment metadata that corresponds to the
 *                                 seriesInstanceUid.
 */

var generateSegmentationDefaultOptions = {
  includeSliceSpacing: true,
  rleEncode: true
};
/**
 * generateSegmentation - Generates cornerstoneTools brush data, given a stack of
 * imageIds, images and the cornerstoneTools brushData.
 *
 * @param  {object[]} images An array of cornerstone images that contain the source
 *                           data under `image.data.byteArray.buffer` or an array of image metadata objects
 *                           from CornerstoneWadoImageLoader's MetadataProvider.
 * @param  {Object|Object[]} inputLabelmaps3D The cornerstone `Labelmap3D` object, or an array of objects.
 * @param  {Object} userOptions Options to pass to the segmentation derivation and `fillSegmentation`.
 * @returns {Blob}
 */

function generateSegmentation$1(images, inputLabelmaps3D) {
  var userOptions = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var isDataAvailable = images[0] && !!images[0].data;

  if (isDataAvailable) {
    // Cornerstone image object
    var isMultiframe = images[0].imageId.includes("?frame");

    var segmentation = _createSegFromImages(images, isMultiframe, userOptions);

    return fillSegmentation$1(segmentation, inputLabelmaps3D, userOptions);
  } else {
    // Cornerstone metadata objects
    var _isMultiframe = images[0].isMultiframe;

    var _segmentation = _createSegFromJSONObjects(images, _isMultiframe, userOptions);

    return fillSegmentation$1(_segmentation, inputLabelmaps3D, userOptions);
  }
}
/**
 * fillSegmentation - Fills a derived segmentation dataset with cornerstoneTools `LabelMap3D` data.
 *
 * @param  {object[]} segmentation An empty segmentation derived dataset.
 * @param  {Object|Object[]} inputLabelmaps3D The cornerstone `Labelmap3D` object, or an array of objects.
 * @param  {Object} userOptions Options object to override default options.
 * @returns {Blob}           description
 */


function fillSegmentation$1(segmentation, inputLabelmaps3D) {
  var userOptions = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var options = Object.assign({}, generateSegmentationDefaultOptions, userOptions); // Use another variable so we don't redefine labelmaps3D.

  var labelmaps3D = Array.isArray(inputLabelmaps3D) ? inputLabelmaps3D : [inputLabelmaps3D];
  var numberOfFrames = 0;
  var referencedFramesPerLabelmap = [];

  var _loop = function _loop(labelmapIndex) {
    var labelmap3D = labelmaps3D[labelmapIndex];
    var labelmaps2D = labelmap3D.labelmaps2D,
        metadata = labelmap3D.metadata;
    var referencedFramesPerSegment = [];

    for (var i = 1; i < metadata.length; i++) {
      if (metadata[i]) {
        referencedFramesPerSegment[i] = [];
      }
    }

    var _loop2 = function _loop2(_i) {
      var labelmap2D = labelmaps2D[_i];

      if (labelmaps2D[_i]) {
        var segmentsOnLabelmap = labelmap2D.segmentsOnLabelmap;
        segmentsOnLabelmap.forEach(function (segmentIndex) {
          if (segmentIndex !== 0) {
            referencedFramesPerSegment[segmentIndex].push(_i);
            numberOfFrames++;
          }
        });
      }
    };

    for (var _i = 0; _i < labelmaps2D.length; _i++) {
      _loop2(_i);
    }

    referencedFramesPerLabelmap[labelmapIndex] = referencedFramesPerSegment;
  };

  for (var labelmapIndex = 0; labelmapIndex < labelmaps3D.length; labelmapIndex++) {
    _loop(labelmapIndex);
  }

  segmentation.setNumberOfFrames(numberOfFrames);

  for (var _labelmapIndex = 0; _labelmapIndex < labelmaps3D.length; _labelmapIndex++) {
    var referencedFramesPerSegment = referencedFramesPerLabelmap[_labelmapIndex];
    var labelmap3D = labelmaps3D[_labelmapIndex];
    var metadata = labelmap3D.metadata;

    for (var segmentIndex = 1; segmentIndex < referencedFramesPerSegment.length; segmentIndex++) {
      var referencedFrameIndicies = referencedFramesPerSegment[segmentIndex];

      if (referencedFrameIndicies) {
        // Frame numbers start from 1.
        var referencedFrameNumbers = referencedFrameIndicies.map(function (element) {
          return element + 1;
        });
        var segmentMetadata = metadata[segmentIndex];

        var labelmaps = _getLabelmapsFromRefernecedFrameIndicies(labelmap3D, referencedFrameIndicies);

        segmentation.addSegmentFromLabelmap(segmentMetadata, labelmaps, segmentIndex, referencedFrameNumbers);
      }
    }
  }

  if (options.rleEncode) {
    var rleEncodedFrames = encode(segmentation.dataset.PixelData, numberOfFrames, segmentation.dataset.Rows, segmentation.dataset.Columns); // Must use fractional now to RLE encode, as the DICOM standard only allows BitStored && BitsAllocated
    // to be 1 for BINARY. This is not ideal and there should be a better format for compression in this manner
    // added to the standard.

    segmentation.assignToDataset({
      BitsAllocated: "8",
      BitsStored: "8",
      HighBit: "7",
      SegmentationType: "FRACTIONAL",
      SegmentationFractionalType: "PROBABILITY",
      MaximumFractionalValue: "255"
    });
    segmentation.dataset._meta.TransferSyntaxUID = {
      Value: ["1.2.840.10008.1.2.5"],
      vr: "UI"
    };
    segmentation.dataset._vrMap.PixelData = "OB";
    segmentation.dataset.PixelData = rleEncodedFrames;
  } else {
    // If no rleEncoding, at least bitpack the data.
    segmentation.bitPackPixelData();
  }

  var segBlob = datasetToBlob(segmentation.dataset);
  return segBlob;
}

function _getLabelmapsFromRefernecedFrameIndicies(labelmap3D, referencedFrameIndicies) {
  var labelmaps2D = labelmap3D.labelmaps2D;
  var labelmaps = [];

  for (var i = 0; i < referencedFrameIndicies.length; i++) {
    var frame = referencedFrameIndicies[i];
    labelmaps.push(labelmaps2D[frame].pixelData);
  }

  return labelmaps;
}
/**
 * _createSegFromImages - description
 *
 * @param  {Object[]} images    An array of the cornerstone image objects.
 * @param  {Boolean} isMultiframe Whether the images are multiframe.
 * @returns {Object}              The Seg derived dataSet.
 */


function _createSegFromImages(images, isMultiframe, options) {
  var datasets = [];

  if (isMultiframe) {
    var image = images[0];
    var arrayBuffer = image.data.byteArray.buffer;
    var dicomData = DicomMessage.readFile(arrayBuffer);
    var dataset = DicomMetaDictionary.naturalizeDataset(dicomData.dict);
    dataset._meta = DicomMetaDictionary.namifyDataset(dicomData.meta);
    datasets.push(dataset);
  } else {
    for (var i = 0; i < images.length; i++) {
      var _image = images[i];
      var _arrayBuffer = _image.data.byteArray.buffer;

      var _dicomData = DicomMessage.readFile(_arrayBuffer);

      var _dataset2 = DicomMetaDictionary.naturalizeDataset(_dicomData.dict);

      _dataset2._meta = DicomMetaDictionary.namifyDataset(_dicomData.meta);
      datasets.push(_dataset2);
    }
  }

  var multiframe = Normalizer.normalizeToDataset(datasets);
  return new Segmentation$4([multiframe], options);
}

function _createSegFromJSONObjects(jsonObjects, isMultiframe, options) {
  var datasets = [];

  if (isMultiframe) {
    var jsonObject = jsonObjects[0];
    var dataset = createImageDataFromMetadata(jsonObject);
    datasets.push(dataset);
  } else {
    for (var i = 0; i < jsonObjects.length; i++) {
      var _jsonObject = jsonObjects[i];

      var _dataset = createImageDataFromMetadata(_jsonObject);

      datasets.push(_dataset);
    }
  }

  var multiframe = Normalizer.normalizeToDataset(datasets);
  return new Segmentation$4([multiframe], options);
}
/**
 * generateToolState - Given a set of cornrstoneTools imageIds and a Segmentation buffer,
 * derive cornerstoneTools toolState and brush metadata.
 *
 * @param  {string[]} imageIds - An array of the imageIds.
 * @param  {ArrayBuffer} arrayBuffer - The SEG arrayBuffer.
 * @param  {*} metadataProvider.
 * @param  {bool} skipOverlapping - skip checks for overlapping segs, default value false.
 * @param  {number} tolerance - default value 1.e-3.
 *
 * @return {[]ArrayBuffer}a list of array buffer for each labelMap
 * @return {Object} an object from which the segment metadata can be derived
 * @return {[][][]} 2D list containing the track of segments per frame
 * @return {[][][]} 3D list containing the track of segments per frame for each labelMap
 *                  (available only for the overlapping case).
 */


function generateToolState$1(imageIds, arrayBuffer, metadataProvider) {
  var skipOverlapping = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var tolerance = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 1e-3;
  var dicomData = DicomMessage.readFile(arrayBuffer);
  var dataset = DicomMetaDictionary.naturalizeDataset(dicomData.dict);
  dataset._meta = DicomMetaDictionary.namifyDataset(dicomData.meta);
  var multiframe = Normalizer.normalizeToDataset([dataset]);
  var imagePlaneModule = metadataProvider.get("imagePlaneModule", imageIds[0]);
  var generalSeriesModule = metadataProvider.get("generalSeriesModule", imageIds[0]);
  var SeriesInstanceUID = null;
  var ImageOrientationPatient = null;
  var rows = null,
      cols = null;

  if (generalSeriesModule) {
    SeriesInstanceUID = generalSeriesModule.seriesInstanceUID;
  } else {
    // in wadors loading metadataProvider should be sent as cornerstoneWADOImageLoader.wadors.metaDataManager
    var metadata = metadataProvider.get(imageIds[0]);
    var sourceImageMetadata = createImageDataFromMetadata(metadata);
    SeriesInstanceUID = sourceImageMetadata.SeriesInstanceUID;
    ImageOrientationPatient = sourceImageMetadata.ImageOrientationPatient;
    rows = sourceImageMetadata.Rows;
    cols = sourceImageMetadata.Columns;
  }

  if (!imagePlaneModule) {
    console.warn("Insufficient metadata, imagePlaneModule missing.");
  }

  if (!ImageOrientationPatient) {
    ImageOrientationPatient = Array.isArray(imagePlaneModule.rowCosines) ? [].concat(_toConsumableArray(imagePlaneModule.rowCosines), _toConsumableArray(imagePlaneModule.columnCosines)) : [imagePlaneModule.rowCosines.x, imagePlaneModule.rowCosines.y, imagePlaneModule.rowCosines.z, imagePlaneModule.columnCosines.x, imagePlaneModule.columnCosines.y, imagePlaneModule.columnCosines.z];
  } // Get IOP from ref series, compute supported orientations:


  var validOrientations = getValidOrientations(ImageOrientationPatient);
  var sliceLength = multiframe.Columns * multiframe.Rows;
  var segMetadata = getSegmentMetadata(multiframe, SeriesInstanceUID);
  var TransferSyntaxUID = multiframe._meta.TransferSyntaxUID.Value[0];
  var pixelData;

  if (TransferSyntaxUID === "1.2.840.10008.1.2.5") {
    var rleEncodedFrames = Array.isArray(multiframe.PixelData) ? multiframe.PixelData : [multiframe.PixelData];
    pixelData = decode(rleEncodedFrames, multiframe.Rows, multiframe.Columns);

    if (multiframe.BitsStored === 1) {
      console.warn("No implementation for rle + bitbacking.");
      return;
    }
  } else {
    pixelData = unpackPixelData(multiframe);

    if (!pixelData) {
      throw new Error("Fractional segmentations are not yet supported");
    }
  } // if generalSeriesModule cannot be retrieved, it is wadors mode, we fill in rows and cols from wadors metadata


  var orientation = checkOrientation(multiframe, validOrientations, [rows || imagePlaneModule.rows, cols || imagePlaneModule.columns, imageIds.length], tolerance);
  var overlapping = false;

  if (!skipOverlapping) {
    overlapping = checkSEGsOverlapping(pixelData, multiframe, imageIds, validOrientations, metadataProvider, tolerance);
  }

  var insertFunction;

  switch (orientation) {
    case "Planar":
      if (overlapping) {
        insertFunction = insertOverlappingPixelDataPlanar;
      } else {
        insertFunction = insertPixelDataPlanar;
      }

      break;

    case "Perpendicular":
      //insertFunction = insertPixelDataPerpendicular;
      throw new Error("Segmentations orthogonal to the acquisition plane of the source data are not yet supported.");

    case "Oblique":
      throw new Error("Segmentations oblique to the acquisition plane of the source data are not yet supported.");
  }
  /* if SEGs are overlapping:
  1) the labelmapBuffer will contain M volumes which have non-overlapping segments;
  2) segmentsOnFrame will have M * numberOfFrames values to track in which labelMap are the segments;
  3) insertFunction will return the number of LabelMaps
  4) generateToolState return is an array*/


  var segmentsOnFrameArray = [];
  segmentsOnFrameArray[0] = [];
  var segmentsOnFrame = [];
  var arrayBufferLength = sliceLength * imageIds.length * 2; // 2 bytes per label voxel in cst4.

  var labelmapBufferArray = [];
  labelmapBufferArray[0] = new ArrayBuffer(arrayBufferLength);
  insertFunction(segmentsOnFrame, segmentsOnFrameArray, labelmapBufferArray, pixelData, multiframe, imageIds, validOrientations, metadataProvider, tolerance);
  return {
    labelmapBufferArray: labelmapBufferArray,
    segMetadata: segMetadata,
    segmentsOnFrame: segmentsOnFrame,
    segmentsOnFrameArray: segmentsOnFrameArray
  };
}
/**
 * Find the reference frame of the segmentation frame in the source data.
 *
 * @param  {Object}      multiframe        dicom metadata
 * @param  {Int}         frameSegment      frame dicom index
 * @param  {String[]}    imageIds          A list of imageIds.
 * @param  {Object}      metadataProvider  A Cornerstone metadataProvider to query
 *                                         metadata from imageIds.
 * @param  {Float}       tolerance         The tolerance parameter
 *
 * @returns {String}     Returns the imageId
 */


function findReferenceSourceImageId(multiframe, frameSegment, imageIds, metadataProvider, tolerance) {
  var imageId = undefined;

  if (!multiframe) {
    return imageId;
  }

  var FrameOfReferenceUID = multiframe.FrameOfReferenceUID,
      PerFrameFunctionalGroupsSequence = multiframe.PerFrameFunctionalGroupsSequence,
      SourceImageSequence = multiframe.SourceImageSequence,
      ReferencedSeriesSequence = multiframe.ReferencedSeriesSequence;

  if (!PerFrameFunctionalGroupsSequence || PerFrameFunctionalGroupsSequence.length === 0) {
    return imageId;
  }

  var PerFrameFunctionalGroup = PerFrameFunctionalGroupsSequence[frameSegment];

  if (!PerFrameFunctionalGroup) {
    return imageId;
  }

  var frameSourceImageSequence = undefined;

  if (SourceImageSequence && SourceImageSequence.length !== 0) {
    frameSourceImageSequence = SourceImageSequence[frameSegment];
  } else if (PerFrameFunctionalGroup.DerivationImageSequence) {
    var DerivationImageSequence = PerFrameFunctionalGroup.DerivationImageSequence;

    if (Array.isArray(DerivationImageSequence)) {
      if (DerivationImageSequence.length !== 0) {
        DerivationImageSequence = DerivationImageSequence[0];
      } else {
        DerivationImageSequence = undefined;
      }
    }

    if (DerivationImageSequence) {
      frameSourceImageSequence = DerivationImageSequence.SourceImageSequence;

      if (Array.isArray(frameSourceImageSequence)) {
        if (frameSourceImageSequence.length !== 0) {
          frameSourceImageSequence = frameSourceImageSequence[0];
        } else {
          frameSourceImageSequence = undefined;
        }
      }
    }
  }

  if (frameSourceImageSequence) {
    imageId = getImageIdOfSourceImagebySourceImageSequence(frameSourceImageSequence, imageIds, metadataProvider);
  }

  if (imageId === undefined && ReferencedSeriesSequence) {
    var referencedSeriesSequence = Array.isArray(ReferencedSeriesSequence) ? ReferencedSeriesSequence[0] : ReferencedSeriesSequence;
    var ReferencedSeriesInstanceUID = referencedSeriesSequence.SeriesInstanceUID;
    imageId = getImageIdOfSourceImagebyGeometry(ReferencedSeriesInstanceUID, FrameOfReferenceUID, PerFrameFunctionalGroup, imageIds, metadataProvider, tolerance);
  }

  return imageId;
}
/**
 * Checks if there is any overlapping segmentations.
 *  @returns {boolean} Returns a flag if segmentations overlapping
 */


function checkSEGsOverlapping(pixelData, multiframe, imageIds, validOrientations, metadataProvider, tolerance) {
  var SharedFunctionalGroupsSequence = multiframe.SharedFunctionalGroupsSequence,
      PerFrameFunctionalGroupsSequence = multiframe.PerFrameFunctionalGroupsSequence,
      SegmentSequence = multiframe.SegmentSequence,
      Rows = multiframe.Rows,
      Columns = multiframe.Columns;
  var numberOfSegs = SegmentSequence.length;

  if (numberOfSegs < 2) {
    return false;
  }

  var sharedImageOrientationPatient = SharedFunctionalGroupsSequence.PlaneOrientationSequence ? SharedFunctionalGroupsSequence.PlaneOrientationSequence.ImageOrientationPatient : undefined;
  var sliceLength = Columns * Rows;
  var groupsLen = PerFrameFunctionalGroupsSequence.length;
  /** sort groupsLen to have all the segments for each frame in an array
   * frame 2 : 1, 2
   * frame 4 : 1, 3
   * frame 5 : 4
   */

  var frameSegmentsMapping = new Map();

  var _loop3 = function _loop3(frameSegment) {
    var segmentIndex = getSegmentIndex(multiframe, frameSegment);

    if (segmentIndex === undefined) {
      console.warn("Could not retrieve the segment index for frame segment " + frameSegment + ", skipping this frame.");
      return "continue";
    }

    var imageId = findReferenceSourceImageId(multiframe, frameSegment, imageIds, metadataProvider, tolerance);

    if (!imageId) {
      console.warn("Image not present in stack, can't import frame : " + frameSegment + ".");
      return "continue";
    }

    var imageIdIndex = imageIds.findIndex(function (element) {
      return element === imageId;
    });

    if (frameSegmentsMapping.has(imageIdIndex)) {
      var segmentArray = frameSegmentsMapping.get(imageIdIndex);

      if (!segmentArray.includes(frameSegment)) {
        segmentArray.push(frameSegment);
        frameSegmentsMapping.set(imageIdIndex, segmentArray);
      }
    } else {
      frameSegmentsMapping.set(imageIdIndex, [frameSegment]);
    }
  };

  for (var frameSegment = 0; frameSegment < groupsLen; ++frameSegment) {
    var _ret = _loop3(frameSegment);

    if (_ret === "continue") continue;
  }

  var _iterator = _createForOfIteratorHelper(frameSegmentsMapping.entries()),
      _step;

  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var _step$value = _slicedToArray(_step.value, 2),
          user = _step$value[0],
          role = _step$value[1];

      var temp2DArray = new Uint16Array(sliceLength).fill(0);

      for (var i = 0; i < role.length; ++i) {
        var _frameSegment = role[i];
        var PerFrameFunctionalGroups = PerFrameFunctionalGroupsSequence[_frameSegment];
        var ImageOrientationPatientI = sharedImageOrientationPatient || PerFrameFunctionalGroups.PlaneOrientationSequence.ImageOrientationPatient;
        var pixelDataI2D = ndarray$1(new Uint8Array(pixelData.buffer, _frameSegment * sliceLength, sliceLength), [Rows, Columns]);
        var alignedPixelDataI = alignPixelDataWithSourceData(pixelDataI2D, ImageOrientationPatientI, validOrientations, tolerance);

        if (!alignedPixelDataI) {
          console.warn("Individual SEG frames are out of plane with respect to the first SEG frame, this is not yet supported, skipping this frame.");
          continue;
        }

        var data = alignedPixelDataI.data;

        for (var j = 0, len = data.length; j < len; ++j) {
          if (data[j] !== 0) {
            temp2DArray[j]++;

            if (temp2DArray[j] > 1) {
              return true;
            }
          }
        }
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  return false;
}

function createImageDataFromMetadata(cornerstoneMetadata) {
  var meta = {};
  var filemeta = ["00020000", "00020001", "00020002", "00020003", "00020010", "00020012", "00020013", "00020016", "00020100", "00020102"]; // delete the cornerstone specific property

  delete cornerstoneMetadata.isMultiframe; // move the file meta tags to meta object

  for (var i = 0; i < filemeta.length; i++) {
    meta[filemeta[i]] = cornerstoneMetadata[filemeta[i]];
    delete cornerstoneMetadata[filemeta[i]];
  }

  var dataset = DicomMetaDictionary.naturalizeDataset(cornerstoneMetadata);
  dataset._meta = DicomMetaDictionary.namifyDataset(meta);
  return dataset;
}

function insertOverlappingPixelDataPlanar(segmentsOnFrame, segmentsOnFrameArray, labelmapBufferArray, pixelData, multiframe, imageIds, validOrientations, metadataProvider, tolerance) {
  var SharedFunctionalGroupsSequence = multiframe.SharedFunctionalGroupsSequence,
      PerFrameFunctionalGroupsSequence = multiframe.PerFrameFunctionalGroupsSequence,
      Rows = multiframe.Rows,
      Columns = multiframe.Columns;
  var sharedImageOrientationPatient = SharedFunctionalGroupsSequence.PlaneOrientationSequence ? SharedFunctionalGroupsSequence.PlaneOrientationSequence.ImageOrientationPatient : undefined;
  var sliceLength = Columns * Rows;
  var arrayBufferLength = sliceLength * imageIds.length * 2; // 2 bytes per label voxel in cst4.
  // indicate the number of labelMaps

  var M = 1; // indicate the current labelMap array index;

  var m = 0; // temp array for checking overlaps

  var tempBuffer = labelmapBufferArray[m].slice(0); // temp list for checking overlaps

  var tempSegmentsOnFrame = cloneDeep(segmentsOnFrameArray[m]);
  /** split overlapping SEGs algorithm for each segment:
   *  A) copy the labelmapBuffer in the array with index 0
   *  B) add the segment pixel per pixel on the copied buffer from (A)
   *  C) if no overlap, copy the results back on the orignal array from (A)
   *  D) if overlap, repeat increasing the index m up to M (if out of memory, add new buffer in the array and M++);
   */

  var numberOfSegs = multiframe.SegmentSequence.length;

  for (var segmentIndexToProcess = 1; segmentIndexToProcess <= numberOfSegs; ++segmentIndexToProcess) {
    var _loop4 = function _loop4(_i2, groupsLen) {
      var PerFrameFunctionalGroups = PerFrameFunctionalGroupsSequence[_i2];
      var segmentIndex = getSegmentIndex(multiframe, _i2);

      if (segmentIndex === undefined) {
        throw new Error("Could not retrieve the segment index. Aborting segmentation loading.");
      }

      if (segmentIndex !== segmentIndexToProcess) {
        i = _i2;
        return "continue";
      }

      var ImageOrientationPatientI = sharedImageOrientationPatient || PerFrameFunctionalGroups.PlaneOrientationSequence.ImageOrientationPatient;
      var pixelDataI2D = ndarray$1(new Uint8Array(pixelData.buffer, _i2 * sliceLength, sliceLength), [Rows, Columns]);
      var alignedPixelDataI = alignPixelDataWithSourceData(pixelDataI2D, ImageOrientationPatientI, validOrientations, tolerance);

      if (!alignedPixelDataI) {
        throw new Error("Individual SEG frames are out of plane with respect to the first SEG frame. " + "This is not yet supported. Aborting segmentation loading.");
      }

      var imageId = findReferenceSourceImageId(multiframe, _i2, imageIds, metadataProvider, tolerance);

      if (!imageId) {
        console.warn("Image not present in stack, can't import frame : " + _i2 + ".");
        i = _i2;
        return "continue";
      }

      var sourceImageMetadata = metadataProvider.get("instance", imageId);

      if (!sourceImageMetadata) {
        // metadataProvider should be sent as cornerstoneWADOImageLoader.wadors.metaDataManager
        var metadata = metadataProvider.get(imageId);
        sourceImageMetadata = createImageDataFromMetadata(metadata);
      }

      if (Rows !== sourceImageMetadata.Rows || Columns !== sourceImageMetadata.Columns) {
        throw new Error("Individual SEG frames have different geometry dimensions (Rows and Columns) " + "respect to the source image reference frame. This is not yet supported. " + "Aborting segmentation loading. ");
      }

      var imageIdIndex = imageIds.findIndex(function (element) {
        return element === imageId;
      });
      var byteOffset = sliceLength * 2 * imageIdIndex; // 2 bytes/pixel

      var labelmap2DView = new Uint16Array(tempBuffer, byteOffset, sliceLength);
      var data = alignedPixelDataI.data;
      var segmentOnFrame = false;

      for (var j = 0, len = alignedPixelDataI.data.length; j < len; ++j) {
        if (data[j]) {
          if (labelmap2DView[j] !== 0) {
            m++;

            if (m >= M) {
              labelmapBufferArray[m] = new ArrayBuffer(arrayBufferLength);
              segmentsOnFrameArray[m] = [];
              M++;
            }

            tempBuffer = labelmapBufferArray[m].slice(0);
            tempSegmentsOnFrame = cloneDeep(segmentsOnFrameArray[m]);
            _i2 = 0;
            break;
          } else {
            labelmap2DView[j] = segmentIndex;
            segmentOnFrame = true;
          }
        }
      }

      if (segmentOnFrame) {
        if (!tempSegmentsOnFrame[imageIdIndex]) {
          tempSegmentsOnFrame[imageIdIndex] = [];
        }

        tempSegmentsOnFrame[imageIdIndex].push(segmentIndex);

        if (!segmentsOnFrame[imageIdIndex]) {
          segmentsOnFrame[imageIdIndex] = [];
        }

        segmentsOnFrame[imageIdIndex].push(segmentIndex);
      }

      i = _i2;
    };

    for (var i = 0, groupsLen = PerFrameFunctionalGroupsSequence.length; i < groupsLen; ++i) {
      var _ret2 = _loop4(i, groupsLen);

      if (_ret2 === "continue") continue;
    }

    labelmapBufferArray[m] = tempBuffer.slice(0);
    segmentsOnFrameArray[m] = cloneDeep(tempSegmentsOnFrame); // reset temp variables/buffers for new segment

    m = 0;
    tempBuffer = labelmapBufferArray[m].slice(0);
    tempSegmentsOnFrame = cloneDeep(segmentsOnFrameArray[m]);
  }
}

var getSegmentIndex = function getSegmentIndex(multiframe, frame) {
  var PerFrameFunctionalGroupsSequence = multiframe.PerFrameFunctionalGroupsSequence,
      SharedFunctionalGroupsSequence = multiframe.SharedFunctionalGroupsSequence;
  var PerFrameFunctionalGroups = PerFrameFunctionalGroupsSequence[frame];
  return PerFrameFunctionalGroups && PerFrameFunctionalGroups.SegmentIdentificationSequence ? PerFrameFunctionalGroups.SegmentIdentificationSequence.ReferencedSegmentNumber : SharedFunctionalGroupsSequence.SegmentIdentificationSequence ? SharedFunctionalGroupsSequence.SegmentIdentificationSequence.ReferencedSegmentNumber : undefined;
};

function insertPixelDataPlanar(segmentsOnFrame, segmentsOnFrameArray, labelmapBufferArray, pixelData, multiframe, imageIds, validOrientations, metadataProvider, tolerance) {
  var SharedFunctionalGroupsSequence = multiframe.SharedFunctionalGroupsSequence,
      PerFrameFunctionalGroupsSequence = multiframe.PerFrameFunctionalGroupsSequence,
      Rows = multiframe.Rows,
      Columns = multiframe.Columns;
  var sharedImageOrientationPatient = SharedFunctionalGroupsSequence.PlaneOrientationSequence ? SharedFunctionalGroupsSequence.PlaneOrientationSequence.ImageOrientationPatient : undefined;
  var sliceLength = Columns * Rows;

  var _loop5 = function _loop5(groupsLen, _i3) {
    var PerFrameFunctionalGroups = PerFrameFunctionalGroupsSequence[_i3];
    var ImageOrientationPatientI = sharedImageOrientationPatient || PerFrameFunctionalGroups.PlaneOrientationSequence.ImageOrientationPatient;
    var pixelDataI2D = ndarray$1(new Uint8Array(pixelData.buffer, _i3 * sliceLength, sliceLength), [Rows, Columns]);
    var alignedPixelDataI = alignPixelDataWithSourceData(pixelDataI2D, ImageOrientationPatientI, validOrientations, tolerance);

    if (!alignedPixelDataI) {
      throw new Error("Individual SEG frames are out of plane with respect to the first SEG frame. " + "This is not yet supported. Aborting segmentation loading.");
    }

    var segmentIndex = getSegmentIndex(multiframe, _i3);

    if (segmentIndex === undefined) {
      throw new Error("Could not retrieve the segment index. Aborting segmentation loading.");
    }

    var imageId = findReferenceSourceImageId(multiframe, _i3, imageIds, metadataProvider, tolerance);

    if (!imageId) {
      console.warn("Image not present in stack, can't import frame : " + _i3 + ".");
      return "continue";
    }

    var sourceImageMetadata = metadataProvider.get("instance", imageId);

    if (!sourceImageMetadata) {
      // metadataProvider should be sent as cornerstoneWADOImageLoader.wadors.metaDataManager
      var metadata = metadataProvider.get(imageId);
      sourceImageMetadata = createImageDataFromMetadata(metadata);
    }

    if (Rows !== sourceImageMetadata.Rows || Columns !== sourceImageMetadata.Columns) {
      throw new Error("Individual SEG frames have different geometry dimensions (Rows and Columns) " + "respect to the source image reference frame. This is not yet supported. " + "Aborting segmentation loading. ");
    }

    var imageIdIndex = imageIds.findIndex(function (element) {
      return element === imageId;
    });
    var byteOffset = sliceLength * 2 * imageIdIndex; // 2 bytes/pixel

    var labelmap2DView = new Uint16Array(labelmapBufferArray[0], byteOffset, sliceLength);
    var data = alignedPixelDataI.data;

    for (var j = 0, len = alignedPixelDataI.data.length; j < len; ++j) {
      if (data[j]) {
        for (var x = j; x < len; ++x) {
          if (data[x]) {
            labelmap2DView[x] = segmentIndex;
          }
        }

        if (!segmentsOnFrame[imageIdIndex]) {
          segmentsOnFrame[imageIdIndex] = [];
        }

        segmentsOnFrame[imageIdIndex].push(segmentIndex);
        break;
      }
    }
  };

  for (var _i3 = 0, groupsLen = PerFrameFunctionalGroupsSequence.length; _i3 < groupsLen; ++_i3) {
    var _ret3 = _loop5(groupsLen, _i3);

    if (_ret3 === "continue") continue;
  }
}

function checkOrientation(multiframe, validOrientations, sourceDataDimensions, tolerance) {
  var SharedFunctionalGroupsSequence = multiframe.SharedFunctionalGroupsSequence,
      PerFrameFunctionalGroupsSequence = multiframe.PerFrameFunctionalGroupsSequence;
  var sharedImageOrientationPatient = SharedFunctionalGroupsSequence.PlaneOrientationSequence ? SharedFunctionalGroupsSequence.PlaneOrientationSequence.ImageOrientationPatient : undefined; // Check if in plane.

  var PerFrameFunctionalGroups = PerFrameFunctionalGroupsSequence[0];
  var iop = sharedImageOrientationPatient || PerFrameFunctionalGroups.PlaneOrientationSequence.ImageOrientationPatient;
  var inPlane = validOrientations.some(function (operation) {
    return compareArrays(iop, operation, tolerance);
  });

  if (inPlane) {
    return "Planar";
  }

  if (checkIfPerpendicular(iop, validOrientations[0], tolerance) && sourceDataDimensions.includes(multiframe.Rows) && sourceDataDimensions.includes(multiframe.Columns)) {
    // Perpendicular and fits on same grid.
    return "Perpendicular";
  }

  return "Oblique";
}
/**
 * checkIfPerpendicular - Returns true if iop1 and iop2 are perpendicular
 * within a tolerance.
 *
 * @param  {Number[6]} iop1 An ImageOrientationPatient array.
 * @param  {Number[6]} iop2 An ImageOrientationPatient array.
 * @param  {Number} tolerance.
 * @return {Boolean} True if iop1 and iop2 are equal.
 */


function checkIfPerpendicular(iop1, iop2, tolerance) {
  var absDotColumnCosines = Math.abs(iop1[0] * iop2[0] + iop1[1] * iop2[1] + iop1[2] * iop2[2]);
  var absDotRowCosines = Math.abs(iop1[3] * iop2[3] + iop1[4] * iop2[4] + iop1[5] * iop2[5]);
  return (absDotColumnCosines < tolerance || Math.abs(absDotColumnCosines - 1) < tolerance) && (absDotRowCosines < tolerance || Math.abs(absDotRowCosines - 1) < tolerance);
}
/**
 * unpackPixelData - Unpacks bitpacked pixelData if the Segmentation is BINARY.
 *
 * @param  {Object} multiframe The multiframe dataset.
 * @return {Uint8Array}      The unpacked pixelData.
 */


function unpackPixelData(multiframe) {
  var segType = multiframe.SegmentationType;
  var data;

  if (Array.isArray(multiframe.PixelData)) {
    data = multiframe.PixelData[0];
  } else {
    data = multiframe.PixelData;
  }

  if (data === undefined) {
    log.error("This segmentation pixeldata is undefined.");
  }

  if (segType === "BINARY") {
    return BitArray.unpack(data);
  }

  var pixelData = new Uint8Array(data);
  var max = multiframe.MaximumFractionalValue;
  var onlyMaxAndZero = pixelData.find(function (element) {
    return element !== 0 && element !== max;
  }) === undefined;

  if (!onlyMaxAndZero) {
    // This is a fractional segmentation, which is not currently supported.
    return;
  }

  log.warn("This segmentation object is actually binary... processing as such.");
  return pixelData;
}
/**
 * getImageIdOfSourceImagebySourceImageSequence - Returns the Cornerstone imageId of the source image.
 *
 * @param  {Object}   SourceImageSequence  Sequence describing the source image.
 * @param  {String[]} imageIds             A list of imageIds.
 * @param  {Object}   metadataProvider     A Cornerstone metadataProvider to query
 *                                         metadata from imageIds.
 * @return {String}                        The corresponding imageId.
 */


function getImageIdOfSourceImagebySourceImageSequence(SourceImageSequence, imageIds, metadataProvider) {
  var ReferencedSOPInstanceUID = SourceImageSequence.ReferencedSOPInstanceUID,
      ReferencedFrameNumber = SourceImageSequence.ReferencedFrameNumber;
  return ReferencedFrameNumber ? getImageIdOfReferencedFrame(ReferencedSOPInstanceUID, ReferencedFrameNumber, imageIds, metadataProvider) : getImageIdOfReferencedSingleFramedSOPInstance(ReferencedSOPInstanceUID, imageIds, metadataProvider);
}
/**
 * getImageIdOfSourceImagebyGeometry - Returns the Cornerstone imageId of the source image.
 *
 * @param  {String}    ReferencedSeriesInstanceUID    Referenced series of the source image.
 * @param  {String}    FrameOfReferenceUID            Frame of reference.
 * @param  {Object}    PerFrameFunctionalGroup        Sequence describing segmentation reference attributes per frame.
 * @param  {String[]}  imageIds                       A list of imageIds.
 * @param  {Object}    metadataProvider               A Cornerstone metadataProvider to query
 * @param  {Float}     tolerance                      The tolerance parameter
 *
 * @return {String}                                   The corresponding imageId.
 */


function getImageIdOfSourceImagebyGeometry(ReferencedSeriesInstanceUID, FrameOfReferenceUID, PerFrameFunctionalGroup, imageIds, metadataProvider, tolerance) {
  if (ReferencedSeriesInstanceUID === undefined || PerFrameFunctionalGroup.PlanePositionSequence === undefined || PerFrameFunctionalGroup.PlanePositionSequence[0] === undefined || PerFrameFunctionalGroup.PlanePositionSequence[0].ImagePositionPatient === undefined) {
    return undefined;
  }

  for (var imageIdsIndexc = 0; imageIdsIndexc < imageIds.length; ++imageIdsIndexc) {
    var sourceImageMetadata = metadataProvider.get("instance", imageIds[imageIdsIndexc]);

    if (!sourceImageMetadata) {
      var metadata = metadataProvider.get(imageIds[imageIdsIndexc]);
      sourceImageMetadata = createImageDataFromMetadata(metadata);
    }

    if (sourceImageMetadata === undefined || sourceImageMetadata.ImagePositionPatient === undefined || sourceImageMetadata.FrameOfReferenceUID !== FrameOfReferenceUID || sourceImageMetadata.SeriesInstanceUID !== ReferencedSeriesInstanceUID) {
      continue;
    }

    if (compareArrays(PerFrameFunctionalGroup.PlanePositionSequence[0].ImagePositionPatient, sourceImageMetadata.ImagePositionPatient, tolerance)) {
      return imageIds[imageIdsIndexc];
    }
  }
}
/**
 * getImageIdOfReferencedSingleFramedSOPInstance - Returns the imageId
 * corresponding to the specified sopInstanceUid for single-frame images.
 *
 * @param  {String} sopInstanceUid   The sopInstanceUid of the desired image.
 * @param  {String[]} imageIds         The list of imageIds.
 * @param  {Object} metadataProvider The metadataProvider to obtain sopInstanceUids
 *                                 from the cornerstone imageIds.
 * @return {String}                  The imageId that corresponds to the sopInstanceUid.
 */


function getImageIdOfReferencedSingleFramedSOPInstance(sopInstanceUid, imageIds, metadataProvider) {
  return imageIds.find(function (imageId) {
    var sopCommonModule = metadataProvider.get("sopCommonModule", imageId);

    if (!sopCommonModule) {
      // in wadors loading metadataProvider should be sent as cornerstoneWADOImageLoader.wadors.metaDataManager
      var metadata = metadataProvider.get(imageId);
      var sourceImageMetadata = createImageDataFromMetadata(metadata);
      if (sourceImageMetadata.SOPInstanceUID) return sourceImageMetadata.SOPInstanceUID === sopInstanceUid;
      return;
    }

    return sopCommonModule.sopInstanceUID === sopInstanceUid;
  });
}
/**
 * getImageIdOfReferencedFrame - Returns the imageId corresponding to the
 * specified sopInstanceUid and frameNumber for multi-frame images.
 *
 * @param  {String} sopInstanceUid   The sopInstanceUid of the desired image.
 * @param  {Number} frameNumber      The frame number.
 * @param  {String} imageIds         The list of imageIds.
 * @param  {Object} metadataProvider The metadataProvider to obtain sopInstanceUids
 *                                   from the cornerstone imageIds.
 * @return {String}                  The imageId that corresponds to the sopInstanceUid.
 */


function getImageIdOfReferencedFrame(sopInstanceUid, frameNumber, imageIds, metadataProvider) {
  var imageId = imageIds.find(function (imageId) {
    var sopCommonModule = metadataProvider.get("sopCommonModule", imageId);

    if (!sopCommonModule) {
      // in wadors loading metadataProvider should be sent as cornerstoneWADOImageLoader.wadors.metaDataManager
      var metadata = metadataProvider.get(imageId);
      var sourceImageMetadata = createImageDataFromMetadata(metadata);

      var _imageIdFrameNumber = Number(imageId.split("/frames/")[1]);

      if (sourceImageMetadata.SOPInstanceUID) return (//frameNumber is zero indexed for cornerstoneWADOImageLoader image Ids.
        sourceImageMetadata.SOPInstanceUID === sopInstanceUid && _imageIdFrameNumber === frameNumber
      );
      return;
    }

    var imageIdFrameNumber = Number(imageId.split("frame=")[1]);
    return (//frameNumber is zero indexed for cornerstoneWADOImageLoader image Ids.
      sopCommonModule.sopInstanceUID === sopInstanceUid && imageIdFrameNumber === frameNumber - 1
    );
  });
  return imageId;
}
/**
 * getValidOrientations - returns an array of valid orientations.
 *
 * @param  {Number[6]} iop The row (0..2) an column (3..5) direction cosines.
 * @return {Number[8][6]} An array of valid orientations.
 */


function getValidOrientations(iop) {
  var orientations = []; // [0,  1,  2]: 0,   0hf,   0vf
  // [3,  4,  5]: 90,  90hf,  90vf
  // [6, 7]:      180, 270

  orientations[0] = iop;
  orientations[1] = flipImageOrientationPatient.h(iop);
  orientations[2] = flipImageOrientationPatient.v(iop);
  var iop90 = rotateDirectionCosinesInPlane(iop, Math.PI / 2);
  orientations[3] = iop90;
  orientations[4] = flipImageOrientationPatient.h(iop90);
  orientations[5] = flipImageOrientationPatient.v(iop90);
  orientations[6] = rotateDirectionCosinesInPlane(iop, Math.PI);
  orientations[7] = rotateDirectionCosinesInPlane(iop, 1.5 * Math.PI);
  return orientations;
}
/**
 * alignPixelDataWithSourceData -
 *
 * @param {Ndarray} pixelData2D - The data to align.
 * @param {Number[6]} iop - The orientation of the image slice.
 * @param {Number[8][6]} orientations - An array of valid imageOrientationPatient values.
 * @param {Number} tolerance.
 * @return {Ndarray} The aligned pixelData.
 */


function alignPixelDataWithSourceData(pixelData2D, iop, orientations, tolerance) {
  if (compareArrays(iop, orientations[0], tolerance)) {
    return pixelData2D;
  } else if (compareArrays(iop, orientations[1], tolerance)) {
    // Flipped vertically.
    // Undo Flip
    return flipMatrix2D.v(pixelData2D);
  } else if (compareArrays(iop, orientations[2], tolerance)) {
    // Flipped horizontally.
    // Unfo flip
    return flipMatrix2D.h(pixelData2D);
  } else if (compareArrays(iop, orientations[3], tolerance)) {
    //Rotated 90 degrees
    // Rotate back
    return rotateMatrix902D(pixelData2D);
  } else if (compareArrays(iop, orientations[4], tolerance)) {
    //Rotated 90 degrees and fliped horizontally.
    // Undo flip and rotate back.
    return rotateMatrix902D(flipMatrix2D.h(pixelData2D));
  } else if (compareArrays(iop, orientations[5], tolerance)) {
    // Rotated 90 degrees and fliped vertically
    // Unfo flip and rotate back.
    return rotateMatrix902D(flipMatrix2D.v(pixelData2D));
  } else if (compareArrays(iop, orientations[6], tolerance)) {
    // Rotated 180 degrees. // TODO -> Do this more effeciently, there is a 1:1 mapping like 90 degree rotation.
    return rotateMatrix902D(rotateMatrix902D(pixelData2D));
  } else if (compareArrays(iop, orientations[7], tolerance)) {
    // Rotated 270 degrees
    // Rotate back.
    return rotateMatrix902D(rotateMatrix902D(rotateMatrix902D(pixelData2D)));
  }
}
/**
 * compareArrays - Returns true if array1 and array2 are equal
 * within a tolerance.
 *
 * @param  {Number[]} array1 - An array.
 * @param  {Number[]} array2 - An array.
 * @param {Number} tolerance.
 * @return {Boolean} True if array1 and array2 are equal.
 */


function compareArrays(array1, array2, tolerance) {
  if (array1.length != array2.length) {
    return false;
  }

  for (var _i4 = 0; _i4 < array1.length; ++_i4) {
    if (!nearlyEqual(array1[_i4], array2[_i4], tolerance)) {
      return false;
    }
  }

  return true;
}

function getSegmentMetadata(multiframe, seriesInstanceUid) {
  var segmentSequence = multiframe.SegmentSequence;
  var data = [];

  if (Array.isArray(segmentSequence)) {
    data = [undefined].concat(_toConsumableArray(segmentSequence));
  } else {
    // Only one segment, will be stored as an object.
    data = [undefined, segmentSequence];
  }

  return {
    seriesInstanceUid: seriesInstanceUid,
    data: data
  };
}

var Segmentation$1 = {
  generateSegmentation: generateSegmentation,
  generateToolState: generateToolState,
  fillSegmentation: fillSegmentation
};
/**
 * generateSegmentation - Generates a DICOM Segmentation object given cornerstoneTools data.
 *
 * @param  {object[]} images    An array of the cornerstone image objects.
 * @param  {Object|Object[]} labelmaps3DorBrushData For 4.X: The cornerstone `Labelmap3D` object, or an array of objects.
 *                                                  For 3.X: the BrushData.
 * @param  {number} cornerstoneToolsVersion The cornerstoneTools major version to map against.
 * @returns {Object}
 */

function generateSegmentation(images, labelmaps3DorBrushData) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
    includeSliceSpacing: true
  };
  var cornerstoneToolsVersion = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 4;

  if (cornerstoneToolsVersion === 4) {
    return Segmentation$2.generateSegmentation(images, labelmaps3DorBrushData, options);
  }

  if (cornerstoneToolsVersion === 3) {
    return Segmentation$3.generateSegmentation(images, labelmaps3DorBrushData, options);
  }

  console.warn("No generateSegmentation adapater for cornerstone version ".concat(cornerstoneToolsVersion, ", exiting."));
}
/**
 * generateToolState - Given a set of cornrstoneTools imageIds and a Segmentation buffer,
 * derive cornerstoneTools toolState and brush metadata.
 *
 * @param  {string[]} imageIds    An array of the imageIds.
 * @param  {ArrayBuffer} arrayBuffer The SEG arrayBuffer.
 * @param {*} metadataProvider
 * @param  {bool} skipOverlapping - skip checks for overlapping segs, default value false.
 * @param  {number} tolerance - default value 1.e-3.
 * @param  {number} cornerstoneToolsVersion - default value 4.
 *
 * @returns {Object}  The toolState and an object from which the
 *                    segment metadata can be derived.
 */


function generateToolState(imageIds, arrayBuffer, metadataProvider) {
  var skipOverlapping = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var tolerance = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 1e-3;
  var cornerstoneToolsVersion = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 4;

  if (cornerstoneToolsVersion === 4) {
    return Segmentation$2.generateToolState(imageIds, arrayBuffer, metadataProvider, skipOverlapping, tolerance);
  }

  if (cornerstoneToolsVersion === 3) {
    return Segmentation$3.generateToolState(imageIds, arrayBuffer, metadataProvider);
  }

  console.warn("No generateToolState adapater for cornerstone version ".concat(cornerstoneToolsVersion, ", exiting."));
}
/**
 * fillSegmentation - Fills a derived segmentation dataset with cornerstoneTools `LabelMap3D` data.
 *
 * @param  {object[]} segmentation An empty segmentation derived dataset.
 * @param  {Object|Object[]} inputLabelmaps3D The cornerstone `Labelmap3D` object, or an array of objects.
 * @param  {Object} userOptions Options object to override default options.
 * @returns {Blob}           description
 */


function fillSegmentation(segmentation, inputLabelmaps3D) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
    includeSliceSpacing: true
  };
  var cornerstoneToolsVersion = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 4;

  if (cornerstoneToolsVersion === 4) {
    return Segmentation$2.fillSegmentation(segmentation, inputLabelmaps3D, options);
  }

  console.warn("No generateSegmentation adapater for cornerstone version ".concat(cornerstoneToolsVersion, ", exiting."));
}

var CobbAngle$1 = /*#__PURE__*/function (_TID300Measurement) {
  _inherits(CobbAngle, _TID300Measurement);

  var _super = _createSuper(CobbAngle);

  function CobbAngle() {
    _classCallCheck(this, CobbAngle);

    return _super.apply(this, arguments);
  }

  _createClass(CobbAngle, [{
    key: "contentItem",
    value: function contentItem() {
      var _this$props = this.props,
          point1 = _this$props.point1,
          point2 = _this$props.point2,
          point3 = _this$props.point3,
          point4 = _this$props.point4,
          rAngle = _this$props.rAngle,
          ReferencedSOPSequence = _this$props.ReferencedSOPSequence;
      return this.getMeasurement([{
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "285285000",
          CodingSchemeDesignator: "SCT",
          CodeMeaning: "Cobb angle"
        },
        MeasuredValueSequence: {
          MeasurementUnitsCodeSequence: {
            CodeValue: "deg",
            CodingSchemeDesignator: "UCUM",
            CodingSchemeVersion: "1.4",
            CodeMeaning: "\xB0"
          },
          NumericValue: rAngle
        },
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: "SCOORD",
          GraphicType: "POLYLINE",
          GraphicData: [point1.x, point1.y, point2.x, point2.y, point3.x, point3.y, point4.x, point4.y],
          ContentSequence: {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }]);
    }
  }]);

  return CobbAngle;
}(TID300Measurement);

var COBB_ANGLE = "CobbAngle";

var CobbAngle = /*#__PURE__*/function () {
  function CobbAngle() {
    _classCallCheck(this, CobbAngle);
  } // TODO: this function is required for all Cornerstone Tool Adapters, since it is called by MeasurementReport.


  _createClass(CobbAngle, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup) {
      var _MeasurementReport$ge = MeasurementReport$3.getSetupMeasurementData(MeasurementGroup),
          defaultState = _MeasurementReport$ge.defaultState,
          NUMGroup = _MeasurementReport$ge.NUMGroup,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup;

      var state = _objectSpread2(_objectSpread2({}, defaultState), {}, {
        rAngle: NUMGroup.MeasuredValueSequence.NumericValue,
        toolType: CobbAngle.toolType,
        handles: {
          start: {},
          end: {},
          start2: {
            highlight: true,
            drawnIndependently: true
          },
          end2: {
            highlight: true,
            drawnIndependently: true
          },
          textBox: {
            hasMoved: false,
            movesIndependently: false,
            drawnIndependently: true,
            allowedOutsideImage: true,
            hasBoundingBox: true
          }
        }
      });

      var _SCOORDGroup$GraphicD = _slicedToArray(SCOORDGroup.GraphicData, 8);

      state.handles.start.x = _SCOORDGroup$GraphicD[0];
      state.handles.start.y = _SCOORDGroup$GraphicD[1];
      state.handles.end.x = _SCOORDGroup$GraphicD[2];
      state.handles.end.y = _SCOORDGroup$GraphicD[3];
      state.handles.start2.x = _SCOORDGroup$GraphicD[4];
      state.handles.start2.y = _SCOORDGroup$GraphicD[5];
      state.handles.end2.x = _SCOORDGroup$GraphicD[6];
      state.handles.end2.y = _SCOORDGroup$GraphicD[7];
      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool) {
      var handles = tool.handles,
          finding = tool.finding,
          findingSites = tool.findingSites;
      var point1 = handles.start;
      var point2 = handles.end;
      var point3 = handles.start2;
      var point4 = handles.end2;
      var rAngle = tool.rAngle;
      var trackingIdentifierTextValue = "cornerstoneTools@^4.0.0:CobbAngle";
      return {
        point1: point1,
        point2: point2,
        point3: point3,
        point4: point4,
        rAngle: rAngle,
        trackingIdentifierTextValue: trackingIdentifierTextValue,
        finding: finding,
        findingSites: findingSites || []
      };
    }
  }]);

  return CobbAngle;
}();

CobbAngle.toolType = COBB_ANGLE;
CobbAngle.utilityToolType = COBB_ANGLE;
CobbAngle.TID300Representation = CobbAngle$1;

CobbAngle.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone4Tag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone4Tag !== CORNERSTONE_4_TAG) {
    return false;
  }

  return toolType === COBB_ANGLE;
};

MeasurementReport$3.registerTool(CobbAngle);

var ANGLE = "Angle";

var Angle = /*#__PURE__*/function () {
  function Angle() {
    _classCallCheck(this, Angle);
  }
  /**
   * Generate TID300 measurement data for a plane angle measurement - use a CobbAngle, but label it as Angle
   * @param  MeasurementGroup
   * @returns
   */


  _createClass(Angle, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup) {
      var _MeasurementReport$ge = MeasurementReport$3.getSetupMeasurementData(MeasurementGroup),
          defaultState = _MeasurementReport$ge.defaultState,
          NUMGroup = _MeasurementReport$ge.NUMGroup,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup;

      var state = _objectSpread2(_objectSpread2({}, defaultState), {}, {
        rAngle: NUMGroup.MeasuredValueSequence.NumericValue,
        toolType: Angle.toolType,
        handles: {
          start: {},
          middle: {},
          end: {},
          textBox: {
            hasMoved: false,
            movesIndependently: false,
            drawnIndependently: true,
            allowedOutsideImage: true,
            hasBoundingBox: true
          }
        }
      });

      var _SCOORDGroup$GraphicD = _slicedToArray(SCOORDGroup.GraphicData, 8);

      state.handles.start.x = _SCOORDGroup$GraphicD[0];
      state.handles.start.y = _SCOORDGroup$GraphicD[1];
      state.handles.middle.x = _SCOORDGroup$GraphicD[2];
      state.handles.middle.y = _SCOORDGroup$GraphicD[3];
      state.handles.middle.x = _SCOORDGroup$GraphicD[4];
      state.handles.middle.y = _SCOORDGroup$GraphicD[5];
      state.handles.end.x = _SCOORDGroup$GraphicD[6];
      state.handles.end.y = _SCOORDGroup$GraphicD[7];
      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool) {
      var handles = tool.handles,
          finding = tool.finding,
          findingSites = tool.findingSites;
      var point1 = handles.start;
      var point2 = handles.middle;
      var point3 = handles.middle;
      var point4 = handles.end;
      var rAngle = tool.rAngle;
      var trackingIdentifierTextValue = "cornerstoneTools@^4.0.0:Angle";
      return {
        point1: point1,
        point2: point2,
        point3: point3,
        point4: point4,
        rAngle: rAngle,
        trackingIdentifierTextValue: trackingIdentifierTextValue,
        finding: finding,
        findingSites: findingSites || []
      };
    }
  }]);

  return Angle;
}();

Angle.toolType = ANGLE;
Angle.utilityToolType = ANGLE;
Angle.TID300Representation = CobbAngle$1;

Angle.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone4Tag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone4Tag !== CORNERSTONE_4_TAG) {
    return false;
  }

  return toolType === ANGLE;
};

MeasurementReport$3.registerTool(Angle);

var RectangleRoi = /*#__PURE__*/function () {
  function RectangleRoi() {
    _classCallCheck(this, RectangleRoi);
  }

  _createClass(RectangleRoi, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup) {
      var _MeasurementReport$ge = MeasurementReport$3.getSetupMeasurementData(MeasurementGroup),
          defaultState = _MeasurementReport$ge.defaultState,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup,
          NUMGroup = _MeasurementReport$ge.NUMGroup;

      var state = _objectSpread2(_objectSpread2({}, defaultState), {}, {
        toolType: RectangleRoi.toolType,
        handles: {
          start: {},
          end: {},
          textBox: {
            active: false,
            hasMoved: false,
            movesIndependently: false,
            drawnIndependently: true,
            allowedOutsideImage: true,
            hasBoundingBox: true
          },
          initialRotation: 0
        },
        cachedStats: {
          area: NUMGroup ? NUMGroup.MeasuredValueSequence.NumericValue : 0
        },
        color: undefined,
        invalidated: true
      });

      var _SCOORDGroup$GraphicD = _slicedToArray(SCOORDGroup.GraphicData, 6);

      state.handles.start.x = _SCOORDGroup$GraphicD[0];
      state.handles.start.y = _SCOORDGroup$GraphicD[1];
      _SCOORDGroup$GraphicD[2];
      _SCOORDGroup$GraphicD[3];
      state.handles.end.x = _SCOORDGroup$GraphicD[4];
      state.handles.end.y = _SCOORDGroup$GraphicD[5];
      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool) {
      var finding = tool.finding,
          findingSites = tool.findingSites,
          _tool$cachedStats = tool.cachedStats,
          cachedStats = _tool$cachedStats === void 0 ? {} : _tool$cachedStats,
          handles = tool.handles;
      console.log("getTID300 Rectangle", tool, cachedStats, handles);
      var start = handles.start,
          end = handles.end;
      var points = [start, {
        x: start.x,
        y: end.y
      }, end, {
        x: end.x,
        y: start.y
      }];
      var area = cachedStats.area,
          perimeter = cachedStats.perimeter;
      console.log("Point=", points, "cachedStats=", cachedStats);
      var trackingIdentifierTextValue = "cornerstoneTools@^4.0.0:RectangleRoi";
      return {
        points: points,
        area: area,
        perimeter: perimeter,
        trackingIdentifierTextValue: trackingIdentifierTextValue,
        finding: finding,
        findingSites: findingSites || []
      };
    }
  }]);

  return RectangleRoi;
}();

RectangleRoi.toolType = "RectangleRoi";
RectangleRoi.utilityToolType = "RectangleRoi";
RectangleRoi.TID300Representation = Polyline$1;

RectangleRoi.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone4Tag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone4Tag !== CORNERSTONE_4_TAG) {
    return false;
  }

  return toolType === RectangleRoi.toolType;
};

MeasurementReport$3.registerTool(RectangleRoi);

var Cornerstone = {
  Length: Length$1,
  FreehandRoi: FreehandRoi,
  Bidirectional: Bidirectional$1,
  EllipticalRoi: EllipticalRoi,
  CircleRoi: CircleRoi,
  ArrowAnnotate: ArrowAnnotate$1,
  MeasurementReport: MeasurementReport$3,
  Segmentation: Segmentation$1,
  CobbAngle: CobbAngle,
  Angle: Angle,
  RectangleRoi: RectangleRoi
};

// This is a custom coding scheme defined to store some annotations from Cornerstone.
// Note: CodeMeaning is VR type LO, which means we only actually support 64 characters
// here this is fine for most labels, but may be problematic at some point.
var CORNERSTONEFREETEXT = "CORNERSTONEFREETEXT"; // Cornerstone specified coding scheme for storing findings

var CodingSchemeDesignator$1 = "CORNERSTONEJS";
var CodingScheme = {
  CodingSchemeDesignator: CodingSchemeDesignator$1,
  codeValues: {
    CORNERSTONEFREETEXT: CORNERSTONEFREETEXT
  }
};

var FINDING = {
  CodingSchemeDesignator: "DCM",
  CodeValue: "121071"
};
var FINDING_SITE = {
  CodingSchemeDesignator: "SCT",
  CodeValue: "363698007"
};
var FINDING_SITE_OLD = {
  CodingSchemeDesignator: "SRT",
  CodeValue: "G-C0E3"
};

var codeValueMatch = function codeValueMatch(group, code, oldCode) {
  var ConceptNameCodeSequence = group.ConceptNameCodeSequence;
  if (!ConceptNameCodeSequence) return;
  var CodingSchemeDesignator = ConceptNameCodeSequence.CodingSchemeDesignator,
      CodeValue = ConceptNameCodeSequence.CodeValue;
  return CodingSchemeDesignator == code.CodingSchemeDesignator && CodeValue == code.CodeValue || oldCode && CodingSchemeDesignator == oldCode.CodingSchemeDesignator && CodeValue == oldCode.CodeValue;
};

function getTID300ContentItem$1(tool, toolType, ReferencedSOPSequence, toolClass, worldToImageCoords) {
  var args = toolClass.getTID300RepresentationArguments(tool, worldToImageCoords);
  args.ReferencedSOPSequence = ReferencedSOPSequence;
  var TID300Measurement = new toolClass.TID300Representation(args);
  return TID300Measurement;
}

function getMeasurementGroup$1(toolType, toolData, ReferencedSOPSequence, worldToImageCoords) {
  var toolTypeData = toolData[toolType];
  var toolClass = MeasurementReport$2.CORNERSTONE_TOOL_CLASSES_BY_TOOL_TYPE[toolType];

  if (!toolTypeData || !toolTypeData.data || !toolTypeData.data.length || !toolClass) {
    return;
  } // Loop through the array of tool instances
  // for this tool


  var Measurements = toolTypeData.data.map(function (tool) {
    return getTID300ContentItem$1(tool, toolType, ReferencedSOPSequence, toolClass, worldToImageCoords);
  });
  return new TID1501MeasurementGroup(Measurements);
}

var MeasurementReport$2 = /*#__PURE__*/function () {
  function MeasurementReport() {
    _classCallCheck(this, MeasurementReport);
  }

  _createClass(MeasurementReport, null, [{
    key: "getCornerstoneLabelFromDefaultState",
    value: function getCornerstoneLabelFromDefaultState(defaultState) {
      var _defaultState$finding = defaultState.findingSites,
          findingSites = _defaultState$finding === void 0 ? [] : _defaultState$finding,
          finding = defaultState.finding;
      var cornersoneFreeTextCodingValue = CodingScheme.codeValues.CORNERSTONEFREETEXT;
      var freeTextLabel = findingSites.find(function (fs) {
        return fs.CodeValue === cornersoneFreeTextCodingValue;
      });

      if (freeTextLabel) {
        return freeTextLabel.CodeMeaning;
      }

      if (finding && finding.CodeValue === cornersoneFreeTextCodingValue) {
        return finding.CodeMeaning;
      }
    }
  }, {
    key: "generateDatasetMeta",
    value: function generateDatasetMeta() {
      // TODO: what is the correct metaheader
      // http://dicom.nema.org/medical/Dicom/current/output/chtml/part10/chapter_7.html
      // TODO: move meta creation to happen in derivations.js
      var fileMetaInformationVersionArray = new Uint8Array(2);
      fileMetaInformationVersionArray[1] = 1;
      var _meta = {
        FileMetaInformationVersion: {
          Value: [fileMetaInformationVersionArray.buffer],
          vr: "OB"
        },
        //MediaStorageSOPClassUID
        //MediaStorageSOPInstanceUID: sopCommonModule.sopInstanceUID,
        TransferSyntaxUID: {
          Value: ["1.2.840.10008.1.2.1"],
          vr: "UI"
        },
        ImplementationClassUID: {
          Value: [DicomMetaDictionary.uid()],
          // TODO: could be git hash or other valid id
          vr: "UI"
        },
        ImplementationVersionName: {
          Value: ["dcmjs"],
          vr: "SH"
        }
      };
      return _meta;
    }
  }, {
    key: "generateDerivationSourceDataset",
    value: function generateDerivationSourceDataset(StudyInstanceUID, SeriesInstanceUID) {
      var _vrMap = {
        PixelData: "OW"
      };

      var _meta = MeasurementReport.generateDatasetMeta();

      var derivationSourceDataset = {
        StudyInstanceUID: StudyInstanceUID,
        SeriesInstanceUID: SeriesInstanceUID,
        _meta: _meta,
        _vrMap: _vrMap
      };
      return derivationSourceDataset;
    }
  }, {
    key: "getSetupMeasurementData",
    value: function getSetupMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, metadata, toolType) {
      var ContentSequence = MeasurementGroup.ContentSequence;
      var contentSequenceArr = toArray(ContentSequence);
      var findingGroup = contentSequenceArr.find(function (group) {
        return codeValueMatch(group, FINDING);
      });
      var findingSiteGroups = contentSequenceArr.filter(function (group) {
        return codeValueMatch(group, FINDING_SITE, FINDING_SITE_OLD);
      }) || [];
      var NUMGroup = contentSequenceArr.find(function (group) {
        return group.ValueType === "NUM";
      });
      var SCOORDGroup = toArray(NUMGroup.ContentSequence).find(function (group) {
        return group.ValueType === "SCOORD";
      });
      var ReferencedSOPSequence = SCOORDGroup.ContentSequence.ReferencedSOPSequence;
      var ReferencedSOPInstanceUID = ReferencedSOPSequence.ReferencedSOPInstanceUID,
          ReferencedFrameNumber = ReferencedSOPSequence.ReferencedFrameNumber;
      var referencedImageId = sopInstanceUIDToImageIdMap[ReferencedSOPInstanceUID];
      var imagePlaneModule = metadata.get("imagePlaneModule", referencedImageId);
      var finding = findingGroup ? addAccessors(findingGroup.ConceptCodeSequence) : undefined;
      var findingSites = findingSiteGroups.map(function (fsg) {
        return addAccessors(fsg.ConceptCodeSequence);
      });
      var defaultState = {
        sopInstanceUid: ReferencedSOPInstanceUID,
        annotation: {
          annotationUID: DicomMetaDictionary.uid(),
          metadata: {
            toolName: toolType,
            referencedImageId: referencedImageId,
            FrameOfReferenceUID: imagePlaneModule.frameOfReferenceUID,
            label: ""
          }
        },
        finding: finding,
        findingSites: findingSites
      };

      if (defaultState.finding) {
        defaultState.description = defaultState.finding.CodeMeaning;
      }

      defaultState.annotation.metadata.label = MeasurementReport.getCornerstoneLabelFromDefaultState(defaultState);
      return {
        defaultState: defaultState,
        NUMGroup: NUMGroup,
        SCOORDGroup: SCOORDGroup,
        ReferencedSOPSequence: ReferencedSOPSequence,
        ReferencedSOPInstanceUID: ReferencedSOPInstanceUID,
        ReferencedFrameNumber: ReferencedFrameNumber
      };
    }
  }, {
    key: "generateReport",
    value: function generateReport(toolState, metadataProvider, worldToImageCoords, options) {
      // ToolState for array of imageIDs to a Report
      // Assume Cornerstone metadata provider has access to Study / Series / Sop Instance UID
      var allMeasurementGroups = [];
      /* Patient ID
      Warning - Missing attribute or value that would be needed to build DICOMDIR - Patient ID
      Warning - Missing attribute or value that would be needed to build DICOMDIR - Study Date
      Warning - Missing attribute or value that would be needed to build DICOMDIR - Study Time
      Warning - Missing attribute or value that would be needed to build DICOMDIR - Study ID
      */

      var sopInstanceUIDsToSeriesInstanceUIDMap = {};
      var derivationSourceDatasets = [];

      var _meta = MeasurementReport.generateDatasetMeta(); // Loop through each image in the toolData


      Object.keys(toolState).forEach(function (imageId) {
        var sopCommonModule = metadataProvider.get("sopCommonModule", imageId);
        var generalSeriesModule = metadataProvider.get("generalSeriesModule", imageId);
        var sopInstanceUID = sopCommonModule.sopInstanceUID,
            sopClassUID = sopCommonModule.sopClassUID;
        var studyInstanceUID = generalSeriesModule.studyInstanceUID,
            seriesInstanceUID = generalSeriesModule.seriesInstanceUID;
        sopInstanceUIDsToSeriesInstanceUIDMap[sopInstanceUID] = seriesInstanceUID;

        if (!derivationSourceDatasets.find(function (dsd) {
          return dsd.SeriesInstanceUID === seriesInstanceUID;
        })) {
          // Entry not present for series, create one.
          var derivationSourceDataset = MeasurementReport.generateDerivationSourceDataset(studyInstanceUID, seriesInstanceUID);
          derivationSourceDatasets.push(derivationSourceDataset);
        }

        var frameNumber = metadataProvider.get("frameNumber", imageId);
        var toolData = toolState[imageId];
        var toolTypes = Object.keys(toolData);
        var ReferencedSOPSequence = {
          ReferencedSOPClassUID: sopClassUID,
          ReferencedSOPInstanceUID: sopInstanceUID
        };
        var instance = metadataProvider.get("instance", imageId);

        if (instance && instance.NumberOfFrames && instance.NumberOfFrames > 1 || Normalizer.isMultiframeSOPClassUID(sopClassUID)) {
          ReferencedSOPSequence.ReferencedFrameNumber = frameNumber;
        } // Loop through each tool type for the image


        var measurementGroups = [];
        toolTypes.forEach(function (toolType) {
          var group = getMeasurementGroup$1(toolType, toolData, ReferencedSOPSequence, worldToImageCoords);

          if (group) {
            measurementGroups.push(group);
          }
        });
        allMeasurementGroups = allMeasurementGroups.concat(measurementGroups);
      });
      var tid1500MeasurementReport = new TID1500MeasurementReport({
        TID1501MeasurementGroups: allMeasurementGroups
      }, options);
      var report = new StructuredReport(derivationSourceDatasets);
      var contentItem = tid1500MeasurementReport.contentItem(derivationSourceDatasets, {
        sopInstanceUIDsToSeriesInstanceUIDMap: sopInstanceUIDsToSeriesInstanceUIDMap
      }); // Merge the derived dataset with the content from the Measurement Report

      report.dataset = Object.assign(report.dataset, contentItem);
      report.dataset._meta = _meta;
      return report;
    }
    /**
     * Generate Cornerstone tool state from dataset
     * @param {object} dataset dataset
     * @param {object} hooks
     * @param {function} hooks.getToolClass Function to map dataset to a tool class
     * @returns
     */

  }, {
    key: "generateToolState",
    value: function generateToolState(dataset, sopInstanceUIDToImageIdMap, imageToWorldCoords, metadata) {
      var hooks = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      // For now, bail out if the dataset is not a TID1500 SR with length measurements
      if (dataset.ContentTemplateSequence.TemplateIdentifier !== "1500") {
        throw new Error("This package can currently only interpret DICOM SR TID 1500");
      }

      var REPORT = "Imaging Measurements";
      var GROUP = "Measurement Group";
      var TRACKING_IDENTIFIER = "Tracking Identifier"; // Identify the Imaging Measurements

      var imagingMeasurementContent = toArray(dataset.ContentSequence).find(codeMeaningEquals(REPORT)); // Retrieve the Measurements themselves

      var measurementGroups = toArray(imagingMeasurementContent.ContentSequence).filter(codeMeaningEquals(GROUP)); // For each of the supported measurement types, compute the measurement data

      var measurementData = {};
      var cornerstoneToolClasses = MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_UTILITY_TYPE;
      var registeredToolClasses = [];
      Object.keys(cornerstoneToolClasses).forEach(function (key) {
        registeredToolClasses.push(cornerstoneToolClasses[key]);
        measurementData[key] = [];
      });
      measurementGroups.forEach(function (measurementGroup, index) {
        var measurementGroupContentSequence = toArray(measurementGroup.ContentSequence);
        var TrackingIdentifierGroup = measurementGroupContentSequence.find(function (contentItem) {
          return contentItem.ConceptNameCodeSequence.CodeMeaning === TRACKING_IDENTIFIER;
        });
        var TrackingIdentifierValue = TrackingIdentifierGroup.TextValue;
        var toolClass = hooks.getToolClass ? hooks.getToolClass(measurementGroup, dataset, registeredToolClasses) : registeredToolClasses.find(function (tc) {
          return tc.isValidCornerstoneTrackingIdentifier(TrackingIdentifierValue);
        });

        if (toolClass) {
          var measurement = toolClass.getMeasurementData(measurementGroup, sopInstanceUIDToImageIdMap, imageToWorldCoords, metadata);
          console.log("=== ".concat(toolClass.toolType, " ==="));
          console.log(measurement);
          measurementData[toolClass.toolType].push(measurement);
        }
      }); // NOTE: There is no way of knowing the cornerstone imageIds as that could be anything.
      // That is up to the consumer to derive from the SOPInstanceUIDs.

      return measurementData;
    }
  }, {
    key: "registerTool",
    value: function registerTool(toolClass) {
      MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_UTILITY_TYPE[toolClass.utilityToolType] = toolClass;
      MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_TOOL_TYPE[toolClass.toolType] = toolClass;
      MeasurementReport.MEASUREMENT_BY_TOOLTYPE[toolClass.toolType] = toolClass.utilityToolType;
    }
  }]);

  return MeasurementReport;
}();
MeasurementReport$2.MEASUREMENT_BY_TOOLTYPE = {};
MeasurementReport$2.CORNERSTONE_TOOL_CLASSES_BY_UTILITY_TYPE = {};
MeasurementReport$2.CORNERSTONE_TOOL_CLASSES_BY_TOOL_TYPE = {};

var CORNERSTONE_3D_TAG = "Cornerstone3DTools@^0.1.0";

var LENGTH = "Length";
var trackingIdentifierTextValue$5 = "".concat(CORNERSTONE_3D_TAG, ":").concat(LENGTH);

var Length = /*#__PURE__*/function () {
  function Length() {
    _classCallCheck(this, Length);
  } // TODO: this function is required for all Cornerstone Tool Adapters, since it is called by MeasurementReport.


  _createClass(Length, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, imageToWorldCoords, metadata) {
      var _MeasurementReport$ge = MeasurementReport$2.getSetupMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, metadata, Length.toolType),
          defaultState = _MeasurementReport$ge.defaultState,
          NUMGroup = _MeasurementReport$ge.NUMGroup,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup,
          ReferencedFrameNumber = _MeasurementReport$ge.ReferencedFrameNumber;

      var referencedImageId = defaultState.annotation.metadata.referencedImageId;
      var GraphicData = SCOORDGroup.GraphicData;
      var worldCoords = [];

      for (var i = 0; i < GraphicData.length; i += 2) {
        var point = imageToWorldCoords(referencedImageId, [GraphicData[i], GraphicData[i + 1]]);
        worldCoords.push(point);
      }

      var state = defaultState;
      state.annotation.data = {
        handles: {
          points: [worldCoords[0], worldCoords[1]],
          activeHandleIndex: 0,
          textBox: {
            hasMoved: false
          }
        },
        cachedStats: _defineProperty({}, "imageId:".concat(referencedImageId), {
          length: NUMGroup ? NUMGroup.MeasuredValueSequence.NumericValue : 0
        }),
        frameNumber: ReferencedFrameNumber
      };
      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool, worldToImageCoords) {
      var data = tool.data,
          finding = tool.finding,
          findingSites = tool.findingSites,
          metadata = tool.metadata;
      var _data$cachedStats = data.cachedStats,
          cachedStats = _data$cachedStats === void 0 ? {} : _data$cachedStats,
          handles = data.handles;
      var referencedImageId = metadata.referencedImageId;

      if (!referencedImageId) {
        throw new Error("Length.getTID300RepresentationArguments: referencedImageId is not defined");
      }

      var start = worldToImageCoords(referencedImageId, handles.points[0]);
      var end = worldToImageCoords(referencedImageId, handles.points[1]);
      var point1 = {
        x: start[0],
        y: start[1]
      };
      var point2 = {
        x: end[0],
        y: end[1]
      };

      var _ref = cachedStats["imageId:".concat(referencedImageId)] || {},
          distance = _ref.length;

      return {
        point1: point1,
        point2: point2,
        distance: distance,
        trackingIdentifierTextValue: trackingIdentifierTextValue$5,
        finding: finding,
        findingSites: findingSites || []
      };
    }
  }]);

  return Length;
}();

Length.toolType = LENGTH;
Length.utilityToolType = LENGTH;
Length.TID300Representation = Length$2;

Length.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone3DTag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone3DTag !== CORNERSTONE_3D_TAG) {
    return false;
  }

  return toolType === LENGTH;
};

MeasurementReport$2.registerTool(Length);

var BIDIRECTIONAL = "Bidirectional";
var LONG_AXIS = "Long Axis";
var SHORT_AXIS = "Short Axis";
var trackingIdentifierTextValue$4 = "".concat(CORNERSTONE_3D_TAG, ":").concat(BIDIRECTIONAL);

var Bidirectional = /*#__PURE__*/function () {
  function Bidirectional() {
    _classCallCheck(this, Bidirectional);
  }

  _createClass(Bidirectional, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, imageToWorldCoords, metadata) {
      var _MeasurementReport$ge = MeasurementReport$2.getSetupMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, metadata, Bidirectional.toolType),
          defaultState = _MeasurementReport$ge.defaultState,
          ReferencedFrameNumber = _MeasurementReport$ge.ReferencedFrameNumber;

      var referencedImageId = defaultState.annotation.metadata.referencedImageId;
      var ContentSequence = MeasurementGroup.ContentSequence;
      var longAxisNUMGroup = toArray(ContentSequence).find(function (group) {
        return group.ConceptNameCodeSequence.CodeMeaning === LONG_AXIS;
      });
      var longAxisSCOORDGroup = toArray(longAxisNUMGroup.ContentSequence).find(function (group) {
        return group.ValueType === "SCOORD";
      });
      var shortAxisNUMGroup = toArray(ContentSequence).find(function (group) {
        return group.ConceptNameCodeSequence.CodeMeaning === SHORT_AXIS;
      });
      var shortAxisSCOORDGroup = toArray(shortAxisNUMGroup.ContentSequence).find(function (group) {
        return group.ValueType === "SCOORD";
      });
      var worldCoords = [];
      [longAxisSCOORDGroup, shortAxisSCOORDGroup].forEach(function (group) {
        var GraphicData = group.GraphicData;

        for (var i = 0; i < GraphicData.length; i += 2) {
          var point = imageToWorldCoords(referencedImageId, [GraphicData[i], GraphicData[i + 1]]);
          worldCoords.push(point);
        }
      });
      var state = defaultState;
      state.annotation.data = {
        handles: {
          points: [worldCoords[0], worldCoords[1], worldCoords[2], worldCoords[3]],
          activeHandleIndex: 0,
          textBox: {
            hasMoved: false
          }
        },
        cachedStats: _defineProperty({}, "imageId:".concat(referencedImageId), {
          length: longAxisNUMGroup.MeasuredValueSequence.NumericValue,
          width: shortAxisNUMGroup.MeasuredValueSequence.NumericValue
        }),
        frameNumber: ReferencedFrameNumber
      };
      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool, worldToImageCoords) {
      var data = tool.data,
          finding = tool.finding,
          findingSites = tool.findingSites,
          metadata = tool.metadata;
      var _data$cachedStats = data.cachedStats,
          cachedStats = _data$cachedStats === void 0 ? {} : _data$cachedStats,
          handles = data.handles;
      var referencedImageId = metadata.referencedImageId;

      if (!referencedImageId) {
        throw new Error("Bidirectional.getTID300RepresentationArguments: referencedImageId is not defined");
      }

      var _ref = cachedStats["imageId:".concat(referencedImageId)] || {},
          length = _ref.length,
          width = _ref.width;

      var points = handles.points; // Find the length and width point pairs by comparing the distances of the points at 0,1 to points at 2,3

      var firstPointPairs = [points[0], points[1]];
      var secondPointPairs = [points[2], points[3]];
      var firstPointPairsDistance = Math.sqrt(Math.pow(firstPointPairs[0][0] - firstPointPairs[1][0], 2) + Math.pow(firstPointPairs[0][1] - firstPointPairs[1][1], 2) + Math.pow(firstPointPairs[0][2] - firstPointPairs[1][2], 2));
      var secondPointPairsDistance = Math.sqrt(Math.pow(secondPointPairs[0][0] - secondPointPairs[1][0], 2) + Math.pow(secondPointPairs[0][1] - secondPointPairs[1][1], 2) + Math.pow(secondPointPairs[0][2] - secondPointPairs[1][2], 2));
      var shortAxisPoints;
      var longAxisPoints;

      if (firstPointPairsDistance > secondPointPairsDistance) {
        shortAxisPoints = firstPointPairs;
        longAxisPoints = secondPointPairs;
      } else {
        shortAxisPoints = secondPointPairs;
        longAxisPoints = firstPointPairs;
      }

      var longAxisStartImage = worldToImageCoords(referencedImageId, shortAxisPoints[0]);
      var longAxisEndImage = worldToImageCoords(referencedImageId, shortAxisPoints[1]);
      var shortAxisStartImage = worldToImageCoords(referencedImageId, longAxisPoints[0]);
      var shortAxisEndImage = worldToImageCoords(referencedImageId, longAxisPoints[1]);
      return {
        longAxis: {
          point1: {
            x: longAxisStartImage[0],
            y: longAxisStartImage[1]
          },
          point2: {
            x: longAxisEndImage[0],
            y: longAxisEndImage[1]
          }
        },
        shortAxis: {
          point1: {
            x: shortAxisStartImage[0],
            y: shortAxisStartImage[1]
          },
          point2: {
            x: shortAxisEndImage[0],
            y: shortAxisEndImage[1]
          }
        },
        longAxisLength: length,
        shortAxisLength: width,
        trackingIdentifierTextValue: trackingIdentifierTextValue$4,
        finding: finding,
        findingSites: findingSites || []
      };
    }
  }]);

  return Bidirectional;
}();

Bidirectional.toolType = BIDIRECTIONAL;
Bidirectional.utilityToolType = BIDIRECTIONAL;
Bidirectional.TID300Representation = Bidirectional$2;

Bidirectional.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone3DTag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone3DTag !== CORNERSTONE_3D_TAG) {
    return false;
  }

  return toolType === BIDIRECTIONAL;
};

MeasurementReport$2.registerTool(Bidirectional);

var ELLIPTICALROI = "EllipticalROI";
var EPSILON = 1e-4;
var trackingIdentifierTextValue$3 = "".concat(CORNERSTONE_3D_TAG, ":").concat(ELLIPTICALROI);

var EllipticalROI = /*#__PURE__*/function () {
  function EllipticalROI() {
    _classCallCheck(this, EllipticalROI);
  }

  _createClass(EllipticalROI, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, imageToWorldCoords, metadata) {
      var _MeasurementReport$ge = MeasurementReport$2.getSetupMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, metadata, EllipticalROI.toolType),
          defaultState = _MeasurementReport$ge.defaultState,
          NUMGroup = _MeasurementReport$ge.NUMGroup,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup,
          ReferencedFrameNumber = _MeasurementReport$ge.ReferencedFrameNumber;

      var referencedImageId = defaultState.annotation.metadata.referencedImageId;
      var GraphicData = SCOORDGroup.GraphicData; // GraphicData is ordered as [majorAxisStartX, majorAxisStartY, majorAxisEndX, majorAxisEndY, minorAxisStartX, minorAxisStartY, minorAxisEndX, minorAxisEndY]
      // But Cornerstone3D points are ordered as top, bottom, left, right for the
      // ellipse so we need to identify if the majorAxis is horizontal or vertical
      // in the image plane and then choose the correct points to use for the ellipse.

      var pointsWorld = [];

      for (var i = 0; i < GraphicData.length; i += 2) {
        var worldPos = imageToWorldCoords(referencedImageId, [GraphicData[i], GraphicData[i + 1]]);
        pointsWorld.push(worldPos);
      }

      var majorAxisStart = fromValues.apply(vec3, _toConsumableArray(pointsWorld[0]));
      var majorAxisEnd = fromValues.apply(vec3, _toConsumableArray(pointsWorld[1]));
      var minorAxisStart = fromValues.apply(vec3, _toConsumableArray(pointsWorld[2]));
      var minorAxisEnd = fromValues.apply(vec3, _toConsumableArray(pointsWorld[3]));
      var majorAxisVec = create();
      sub(majorAxisVec, majorAxisEnd, majorAxisStart); // normalize majorAxisVec to avoid scaling issues

      normalize$1(majorAxisVec, majorAxisVec);
      var minorAxisVec = create();
      sub(minorAxisVec, minorAxisEnd, minorAxisStart);
      normalize$1(minorAxisVec, minorAxisVec);
      var imagePlaneModule = metadata.get("imagePlaneModule", referencedImageId);

      if (!imagePlaneModule) {
        throw new Error("imageId does not have imagePlaneModule metadata");
      }

      var columnCosines = imagePlaneModule.columnCosines; // find which axis is parallel to the columnCosines

      var columnCosinesVec = fromValues.apply(vec3, _toConsumableArray(columnCosines));
      var projectedMajorAxisOnColVec = dot(columnCosinesVec, majorAxisVec);
      var projectedMinorAxisOnColVec = dot(columnCosinesVec, minorAxisVec);
      var absoluteOfMajorDotProduct = Math.abs(projectedMajorAxisOnColVec);
      var absoluteOfMinorDotProduct = Math.abs(projectedMinorAxisOnColVec);
      var ellipsePoints = [];

      if (Math.abs(absoluteOfMajorDotProduct - 1) < EPSILON) {
        ellipsePoints = [pointsWorld[0], pointsWorld[1], pointsWorld[2], pointsWorld[3]];
      } else if (Math.abs(absoluteOfMinorDotProduct - 1) < EPSILON) {
        ellipsePoints = [pointsWorld[2], pointsWorld[3], pointsWorld[0], pointsWorld[1]];
      } else {
        console.warn("OBLIQUE ELLIPSE NOT YET SUPPORTED");
      }

      var state = defaultState;
      state.annotation.data = {
        handles: {
          points: _toConsumableArray(ellipsePoints),
          activeHandleIndex: 0,
          textBox: {
            hasMoved: false
          }
        },
        cachedStats: _defineProperty({}, "imageId:".concat(referencedImageId), {
          area: NUMGroup ? NUMGroup.MeasuredValueSequence.NumericValue : 0
        }),
        frameNumber: ReferencedFrameNumber
      };
      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool, worldToImageCoords) {
      var data = tool.data,
          finding = tool.finding,
          findingSites = tool.findingSites,
          metadata = tool.metadata;
      var _data$cachedStats = data.cachedStats,
          cachedStats = _data$cachedStats === void 0 ? {} : _data$cachedStats,
          handles = data.handles;
      var referencedImageId = metadata.referencedImageId;

      if (!referencedImageId) {
        throw new Error("EllipticalROI.getTID300RepresentationArguments: referencedImageId is not defined");
      }

      var top = worldToImageCoords(referencedImageId, handles.points[0]);
      var bottom = worldToImageCoords(referencedImageId, handles.points[1]);
      var left = worldToImageCoords(referencedImageId, handles.points[2]);
      var right = worldToImageCoords(referencedImageId, handles.points[3]); // find the major axis and minor axis

      var topBottomLength = Math.abs(top[1] - bottom[1]);
      var leftRightLength = Math.abs(left[0] - right[0]);
      var points = [];

      if (topBottomLength > leftRightLength) {
        // major axis is bottom to top
        points.push({
          x: top[0],
          y: top[1]
        });
        points.push({
          x: bottom[0],
          y: bottom[1]
        }); // minor axis is left to right

        points.push({
          x: left[0],
          y: left[1]
        });
        points.push({
          x: right[0],
          y: right[1]
        });
      } else {
        // major axis is left to right
        points.push({
          x: left[0],
          y: left[1]
        });
        points.push({
          x: right[0],
          y: right[1]
        }); // minor axis is bottom to top

        points.push({
          x: top[0],
          y: top[1]
        });
        points.push({
          x: bottom[0],
          y: bottom[1]
        });
      }

      var _ref = cachedStats["imageId:".concat(referencedImageId)] || {},
          area = _ref.area;

      return {
        area: area,
        points: points,
        trackingIdentifierTextValue: trackingIdentifierTextValue$3,
        finding: finding,
        findingSites: findingSites || []
      };
    }
  }]);

  return EllipticalROI;
}();

EllipticalROI.toolType = ELLIPTICALROI;
EllipticalROI.utilityToolType = ELLIPTICALROI;
EllipticalROI.TID300Representation = Ellipse$1;

EllipticalROI.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone3DTag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone3DTag !== CORNERSTONE_3D_TAG) {
    return false;
  } // The following is needed since the new cornerstone3D has changed
  // the EllipticalRoi toolName (which was in the old cornerstone) to EllipticalROI


  return toolType.toLowerCase() === ELLIPTICALROI.toLowerCase();
};

MeasurementReport$2.registerTool(EllipticalROI);

var ARROW_ANNOTATE = "ArrowAnnotate";
var trackingIdentifierTextValue$2 = "".concat(CORNERSTONE_3D_TAG, ":").concat(ARROW_ANNOTATE);
var codeValues = CodingScheme.codeValues,
    CodingSchemeDesignator = CodingScheme.CodingSchemeDesignator;

var ArrowAnnotate = /*#__PURE__*/function () {
  function ArrowAnnotate() {
    _classCallCheck(this, ArrowAnnotate);
  }

  _createClass(ArrowAnnotate, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, imageToWorldCoords, metadata) {
      var _MeasurementReport$ge = MeasurementReport$2.getSetupMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, metadata, ArrowAnnotate.toolType),
          defaultState = _MeasurementReport$ge.defaultState,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup,
          ReferencedFrameNumber = _MeasurementReport$ge.ReferencedFrameNumber;

      var referencedImageId = defaultState.annotation.metadata.referencedImageId;
      var text = defaultState.annotation.metadata.label;
      var GraphicData = SCOORDGroup.GraphicData;
      var worldCoords = [];

      for (var i = 0; i < GraphicData.length; i += 2) {
        var point = imageToWorldCoords(referencedImageId, [GraphicData[i], GraphicData[i + 1]]);
        worldCoords.push(point);
      } // Since the arrowAnnotate measurement is just a point, to generate the tool state
      // we derive the second point based on the image size relative to the first point.


      if (worldCoords.length === 1) {
        var imagePixelModule = metadata.get("imagePixelModule", referencedImageId);
        var xOffset = 10;
        var yOffset = 10;

        if (imagePixelModule) {
          var columns = imagePixelModule.columns,
              rows = imagePixelModule.rows;
          xOffset = columns / 10;
          yOffset = rows / 10;
        }

        var secondPoint = imageToWorldCoords(referencedImageId, [GraphicData[0] + xOffset, GraphicData[1] + yOffset]);
        worldCoords.push(secondPoint);
      }

      var state = defaultState;
      state.annotation.data = {
        text: text,
        handles: {
          arrowFirst: true,
          points: [worldCoords[0], worldCoords[1]],
          activeHandleIndex: 0,
          textBox: {
            hasMoved: false
          }
        },
        frameNumber: ReferencedFrameNumber
      };
      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool, worldToImageCoords) {
      var data = tool.data,
          metadata = tool.metadata;
      var finding = tool.finding,
          findingSites = tool.findingSites;
      var referencedImageId = metadata.referencedImageId;

      if (!referencedImageId) {
        throw new Error("ArrowAnnotate.getTID300RepresentationArguments: referencedImageId is not defined");
      }

      var _data$handles = data.handles,
          points = _data$handles.points,
          arrowFirst = _data$handles.arrowFirst;
      var point;

      if (arrowFirst) {
        point = points[0];
      } else {
        point = points[1];
      }

      var pointImage = worldToImageCoords(referencedImageId, point);
      var TID300RepresentationArguments = {
        points: [{
          x: pointImage[0],
          y: pointImage[1]
        }],
        trackingIdentifierTextValue: trackingIdentifierTextValue$2,
        findingSites: findingSites || []
      }; // If freetext finding isn't present, add it from the tool text.

      if (!finding || finding.CodeValue !== codeValues.CORNERSTONEFREETEXT) {
        finding = {
          CodeValue: codeValues.CORNERSTONEFREETEXT,
          CodingSchemeDesignator: CodingSchemeDesignator,
          CodeMeaning: data.text
        };
      }

      TID300RepresentationArguments.finding = finding;
      return TID300RepresentationArguments;
    }
  }]);

  return ArrowAnnotate;
}();

ArrowAnnotate.toolType = ARROW_ANNOTATE;
ArrowAnnotate.utilityToolType = ARROW_ANNOTATE;
ArrowAnnotate.TID300Representation = Point$1;

ArrowAnnotate.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone3DTag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone3DTag !== CORNERSTONE_3D_TAG) {
    return false;
  }

  return toolType === ARROW_ANNOTATE;
};

MeasurementReport$2.registerTool(ArrowAnnotate);

var PROBE = "Probe";
var trackingIdentifierTextValue$1 = "".concat(CORNERSTONE_3D_TAG, ":").concat(PROBE);

var Probe = /*#__PURE__*/function () {
  function Probe() {
    _classCallCheck(this, Probe);
  }

  _createClass(Probe, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, imageToWorldCoords, metadata) {
      var _MeasurementReport$ge = MeasurementReport$2.getSetupMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, metadata, Probe.toolType),
          defaultState = _MeasurementReport$ge.defaultState,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup,
          ReferencedFrameNumber = _MeasurementReport$ge.ReferencedFrameNumber;

      var referencedImageId = defaultState.annotation.metadata.referencedImageId;
      var GraphicData = SCOORDGroup.GraphicData;
      var worldCoords = [];

      for (var i = 0; i < GraphicData.length; i += 2) {
        var point = imageToWorldCoords(referencedImageId, [GraphicData[i], GraphicData[i + 1]]);
        worldCoords.push(point);
      }

      var state = defaultState;
      state.annotation.data = {
        handles: {
          points: worldCoords,
          activeHandleIndex: null,
          textBox: {
            hasMoved: false
          }
        },
        frameNumber: ReferencedFrameNumber
      };
      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool, worldToImageCoords) {
      var data = tool.data,
          metadata = tool.metadata;
      var finding = tool.finding,
          findingSites = tool.findingSites;
      var referencedImageId = metadata.referencedImageId;

      if (!referencedImageId) {
        throw new Error("Probe.getTID300RepresentationArguments: referencedImageId is not defined");
      }

      var points = data.handles.points;
      var pointsImage = points.map(function (point) {
        var pointImage = worldToImageCoords(referencedImageId, point);
        return {
          x: pointImage[0],
          y: pointImage[1]
        };
      });
      var TID300RepresentationArguments = {
        points: pointsImage,
        trackingIdentifierTextValue: trackingIdentifierTextValue$1,
        findingSites: findingSites || [],
        finding: finding
      };
      return TID300RepresentationArguments;
    }
  }]);

  return Probe;
}();

Probe.toolType = PROBE;
Probe.utilityToolType = PROBE;
Probe.TID300Representation = Point$1;

Probe.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone3DTag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone3DTag !== CORNERSTONE_3D_TAG) {
    return false;
  }

  return toolType === PROBE;
};

MeasurementReport$2.registerTool(Probe);

var PLANARFREEHANDROI = "PlanarFreehandROI";
var trackingIdentifierTextValue = "".concat(CORNERSTONE_3D_TAG, ":").concat(PLANARFREEHANDROI);
var closedContourThreshold = 1e-5;

var PlanarFreehandROI = /*#__PURE__*/function () {
  function PlanarFreehandROI() {
    _classCallCheck(this, PlanarFreehandROI);
  }

  _createClass(PlanarFreehandROI, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, imageToWorldCoords, metadata) {
      var _MeasurementReport$ge = MeasurementReport$2.getSetupMeasurementData(MeasurementGroup, sopInstanceUIDToImageIdMap, metadata, PlanarFreehandROI.toolType),
          defaultState = _MeasurementReport$ge.defaultState,
          SCOORDGroup = _MeasurementReport$ge.SCOORDGroup,
          ReferencedFrameNumber = _MeasurementReport$ge.ReferencedFrameNumber;

      var referencedImageId = defaultState.annotation.metadata.referencedImageId;
      var GraphicData = SCOORDGroup.GraphicData;
      var worldCoords = [];

      for (var i = 0; i < GraphicData.length; i += 2) {
        var point = imageToWorldCoords(referencedImageId, [GraphicData[i], GraphicData[i + 1]]);
        worldCoords.push(point);
      }

      var distanceBetweenFirstAndLastPoint = distance(worldCoords[worldCoords.length - 1], worldCoords[0]);
      var isOpenContour = true; // If the contour is closed, this should have been encoded as exactly the same point, so check for a very small difference.

      if (distanceBetweenFirstAndLastPoint < closedContourThreshold) {
        worldCoords.pop(); // Remove the last element which is duplicated.

        isOpenContour = false;
      }

      var points = [];

      if (isOpenContour) {
        points.push(worldCoords[0], worldCoords[worldCoords.length - 1]);
      }

      var state = defaultState;
      state.annotation.data = {
        polyline: worldCoords,
        isOpenContour: isOpenContour,
        handles: {
          points: points,
          activeHandleIndex: null,
          textBox: {
            hasMoved: false
          }
        },
        frameNumber: ReferencedFrameNumber
      };
      return state;
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(tool, worldToImageCoords) {
      var data = tool.data,
          finding = tool.finding,
          findingSites = tool.findingSites,
          metadata = tool.metadata;
      var isOpenContour = data.isOpenContour,
          polyline = data.polyline;
      var referencedImageId = metadata.referencedImageId;

      if (!referencedImageId) {
        throw new Error("PlanarFreehandROI.getTID300RepresentationArguments: referencedImageId is not defined");
      }

      var points = polyline.map(function (worldPos) {
        return worldToImageCoords(referencedImageId, worldPos);
      });

      if (!isOpenContour) {
        // Need to repeat the first point at the end of to have an explicitly closed contour.
        var firstPoint = points[0]; // Explicitly expand to avoid ciruclar references.

        points.push([firstPoint[0], firstPoint[1]]);
      }

      var area = 0; // TODO -> The tool doesn't have these stats yet.

      var perimeter = 0;
      return {
        points: points,
        area: area,
        perimeter: perimeter,
        trackingIdentifierTextValue: trackingIdentifierTextValue,
        finding: finding,
        findingSites: findingSites || []
      };
    }
  }]);

  return PlanarFreehandROI;
}();

PlanarFreehandROI.toolType = PLANARFREEHANDROI;
PlanarFreehandROI.utilityToolType = PLANARFREEHANDROI;
PlanarFreehandROI.TID300Representation = Polyline$1;

PlanarFreehandROI.isValidCornerstoneTrackingIdentifier = function (TrackingIdentifier) {
  if (!TrackingIdentifier.includes(":")) {
    return false;
  }

  var _TrackingIdentifier$s = TrackingIdentifier.split(":"),
      _TrackingIdentifier$s2 = _slicedToArray(_TrackingIdentifier$s, 2),
      cornerstone3DTag = _TrackingIdentifier$s2[0],
      toolType = _TrackingIdentifier$s2[1];

  if (cornerstone3DTag !== CORNERSTONE_3D_TAG) {
    return false;
  }

  return toolType === PLANARFREEHANDROI;
};

MeasurementReport$2.registerTool(PlanarFreehandROI);

var Cornerstone3D = {
  Length: Length,
  Bidirectional: Bidirectional,
  EllipticalROI: EllipticalROI,
  ArrowAnnotate: ArrowAnnotate,
  Probe: Probe,
  PlanarFreehandROI: PlanarFreehandROI,
  MeasurementReport: MeasurementReport$2,
  CodeScheme: CodingScheme,
  CORNERSTONE_3D_TAG: CORNERSTONE_3D_TAG
};

// Should we move it to Colors.js

function dicomlab2RGBA(cielab) {
  var rgba = Colors.dicomlab2RGB(cielab).map(function (x) {
    return Math.round(x * 255);
  });
  rgba.push(255);
  return rgba;
} // TODO: Copied these functions in from VTK Math so we don't need a dependency.
// I guess we should put them somewhere
// https://github.com/Kitware/vtk-js/blob/master/Sources/Common/Core/Math/index.js


function cross(x, y, out) {
  var Zx = x[1] * y[2] - x[2] * y[1];
  var Zy = x[2] * y[0] - x[0] * y[2];
  var Zz = x[0] * y[1] - x[1] * y[0];
  out[0] = Zx;
  out[1] = Zy;
  out[2] = Zz;
}

function norm(x) {
  var n = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 3;

  switch (n) {
    case 1:
      return Math.abs(x);

    case 2:
      return Math.sqrt(x[0] * x[0] + x[1] * x[1]);

    case 3:
      return Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);

    default:
      {
        var sum = 0;

        for (var i = 0; i < n; i++) {
          sum += x[i] * x[i];
        }

        return Math.sqrt(sum);
      }
  }
}

function normalize(x) {
  var den = norm(x);

  if (den !== 0.0) {
    x[0] /= den;
    x[1] /= den;
    x[2] /= den;
  }

  return den;
}

function subtract(a, b, out) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
} // TODO: This is a useful utility on its own. We should move it somewhere?
// dcmjs.adapters.vtk.Multiframe? dcmjs.utils?


function geometryFromFunctionalGroups(dataset, PerFrameFunctionalGroups) {
  var geometry = {};
  var pixelMeasures = dataset.SharedFunctionalGroupsSequence.PixelMeasuresSequence;
  var planeOrientation = dataset.SharedFunctionalGroupsSequence.PlaneOrientationSequence; // Find the origin of the volume from the PerFrameFunctionalGroups' ImagePositionPatient values
  //
  // TODO: assumes sorted frames. This should read the ImagePositionPatient from each frame and
  // sort them to obtain the first and last position along the acquisition axis.

  var firstFunctionalGroup = PerFrameFunctionalGroups[0];
  var lastFunctionalGroup = PerFrameFunctionalGroups[PerFrameFunctionalGroups.length - 1];
  var firstPosition = firstFunctionalGroup.PlanePositionSequence.ImagePositionPatient.map(Number);
  var lastPosition = lastFunctionalGroup.PlanePositionSequence.ImagePositionPatient.map(Number);
  geometry.origin = firstPosition; // NB: DICOM PixelSpacing is defined as Row then Column,
  // unlike ImageOrientationPatient

  geometry.spacing = [pixelMeasures.PixelSpacing[1], pixelMeasures.PixelSpacing[0], pixelMeasures.SpacingBetweenSlices].map(Number);
  geometry.dimensions = [dataset.Columns, dataset.Rows, PerFrameFunctionalGroups.length].map(Number);
  var orientation = planeOrientation.ImageOrientationPatient.map(Number);
  var columnStepToPatient = orientation.slice(0, 3);
  var rowStepToPatient = orientation.slice(3, 6);
  geometry.planeNormal = [];
  cross(columnStepToPatient, rowStepToPatient, geometry.planeNormal);
  geometry.sliceStep = [];
  subtract(lastPosition, firstPosition, geometry.sliceStep);
  normalize(geometry.sliceStep);
  geometry.direction = columnStepToPatient.concat(rowStepToPatient).concat(geometry.sliceStep);
  return geometry;
}

var Segmentation = /*#__PURE__*/function () {
  function Segmentation() {
    _classCallCheck(this, Segmentation);
  }
  /**
   * Produces an array of Segments from an input DICOM Segmentation dataset
   *
   * Segments are returned with Geometry values that can be used to create
   * VTK Image Data objects.
   *
   * @example Example usage to create VTK Volume actors from each segment:
   *
   * const actors = [];
   * const segments = generateToolState(dataset);
   * segments.forEach(segment => {
   *   // now make actors using the segment information
   *   const scalarArray = vtk.Common.Core.vtkDataArray.newInstance({
   *        name: "Scalars",
   *        numberOfComponents: 1,
   *        values: segment.pixelData,
   *    });
   *
   *    const imageData = vtk.Common.DataModel.vtkImageData.newInstance();
   *    imageData.getPointData().setScalars(scalarArray);
   *    imageData.setDimensions(geometry.dimensions);
   *    imageData.setSpacing(geometry.spacing);
   *    imageData.setOrigin(geometry.origin);
   *    imageData.setDirection(geometry.direction);
   *
   *    const mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance();
   *    mapper.setInputData(imageData);
   *    mapper.setSampleDistance(2.);
   *
   *    const actor = vtk.Rendering.Core.vtkVolume.newInstance();
   *    actor.setMapper(mapper);
   *
   *    actors.push(actor);
   * });
   *
   * @param dataset
   * @return {{}}
   */


  _createClass(Segmentation, null, [{
    key: "generateSegments",
    value: function generateSegments(dataset) {
      if (dataset.SegmentSequence.constructor.name !== "Array") {
        dataset.SegmentSequence = [dataset.SegmentSequence];
      }

      dataset.SegmentSequence.forEach(function (segment) {
        // TODO: other interesting fields could be extracted from the segment
        // TODO: Read SegmentsOverlay field
        // http://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.8.20.2.html
        // TODO: Looks like vtkColor only wants RGB in 0-1 values.
        // Why was this example converting to RGBA with 0-255 values?
        var color = dicomlab2RGBA(segment.RecommendedDisplayCIELabValue);
        segments[segment.SegmentNumber] = {
          color: color,
          functionalGroups: [],
          offset: null,
          size: null,
          pixelData: null
        };
      }); // make a list of functional groups per segment

      dataset.PerFrameFunctionalGroupsSequence.forEach(function (functionalGroup) {
        var segmentNumber = functionalGroup.SegmentIdentificationSequence.ReferencedSegmentNumber;
        segments[segmentNumber].functionalGroups.push(functionalGroup);
      }); // determine per-segment index into the pixel data
      // TODO: only handles one-bit-per pixel

      var frameSize = Math.ceil(dataset.Rows * dataset.Columns / 8);
      var nextOffset = 0;
      Object.keys(segments).forEach(function (segmentNumber) {
        var segment = segments[segmentNumber];
        segment.numberOfFrames = segment.functionalGroups.length;
        segment.size = segment.numberOfFrames * frameSize;
        segment.offset = nextOffset;
        nextOffset = segment.offset + segment.size;
        var packedSegment = dataset.PixelData.slice(segment.offset, nextOffset);
        segment.pixelData = BitArray.unpack(packedSegment);
        var geometry = geometryFromFunctionalGroups(dataset, segment.functionalGroups);
        segment.geometry = geometry;
      });
      return segments;
    }
  }]);

  return Segmentation;
}();

var VTKjs = {
  Segmentation: Segmentation
};

function getTID300ContentItem(tool, toolClass) {
  var args = toolClass.getTID300RepresentationArguments(tool);
  args.use3DSpatialCoordinates = true;
  return new toolClass.TID300Representation(args);
}

function getMeasurementGroup(graphicType, measurements) {
  var toolClass = MeasurementReport$1.MICROSCOPY_TOOL_CLASSES_BY_TOOL_TYPE[graphicType]; // Loop through the array of tool instances
  // for this tool

  var Measurements = measurements.map(function (tool) {
    return getTID300ContentItem(tool, toolClass);
  });
  return new TID1501MeasurementGroup(Measurements);
}

var MeasurementReport$1 = /*#__PURE__*/function () {
  function MeasurementReport() {
    _classCallCheck(this, MeasurementReport);
  }

  _createClass(MeasurementReport, null, [{
    key: "generateReport",
    value: function generateReport(rois, metadataProvider, options) {
      // Input is all ROIS returned via viewer.getALLROIs()
      // let report = MeasurementReport.generateReport(viewer.getAllROIs());
      // Sort and split into arrays by scoord3d.graphicType
      var measurementsByGraphicType = {};
      rois.forEach(function (roi) {
        var graphicType = roi.scoord3d.graphicType;

        if (graphicType !== "POINT") {
          // adding z coord as 0
          roi.scoord3d.graphicData.map(function (coord) {
            return coord.push(0);
          });
        }

        if (!measurementsByGraphicType[graphicType]) {
          measurementsByGraphicType[graphicType] = [];
        }

        measurementsByGraphicType[graphicType].push(roi.scoord3d);
      }); // For each measurement, get the utility arguments using the adapter, and create TID300 Measurement
      // Group these TID300 Measurements into a TID1501 Measurement Group (for each graphicType)
      // Use TID1500MeasurementReport utility to create a single report from the created groups
      // return report;

      var allMeasurementGroups = [];
      var measurementGroups = [];
      Object.keys(measurementsByGraphicType).forEach(function (graphicType) {
        var measurements = measurementsByGraphicType[graphicType];
        var group = getMeasurementGroup(graphicType, measurements);

        if (group) {
          measurementGroups.push(group);
        }

        allMeasurementGroups = allMeasurementGroups.concat(measurementGroups);
      });

      var _MeasurementReport = new TID1500MeasurementReport({
        TID1501MeasurementGroups: allMeasurementGroups
      }, options); // TODO: what is the correct metaheader
      // http://dicom.nema.org/medical/Dicom/current/output/chtml/part10/chapter_7.html
      // TODO: move meta creation to happen in derivations.js


      var fileMetaInformationVersionArray = new Uint8Array(2);
      fileMetaInformationVersionArray[1] = 1; // TODO: Find out how to reference the data from dicom-microscopy-viewer

      var studyInstanceUID = "12.4";
      var seriesInstanceUID = "12.4";
      var derivationSourceDataset = {
        StudyInstanceUID: studyInstanceUID,
        SeriesInstanceUID: seriesInstanceUID //SOPInstanceUID: sopInstanceUID, // TODO: Necessary?
        //SOPClassUID: sopClassUID,

      };
      var _meta = {
        FileMetaInformationVersion: {
          Value: [fileMetaInformationVersionArray.buffer],
          vr: "OB"
        },
        //MediaStorageSOPClassUID
        //MediaStorageSOPInstanceUID: sopCommonModule.sopInstanceUID,
        TransferSyntaxUID: {
          Value: ["1.2.840.10008.1.2.1"],
          vr: "UI"
        },
        ImplementationClassUID: {
          Value: [DicomMetaDictionary.uid()],
          // TODO: could be git hash or other valid id
          vr: "UI"
        },
        ImplementationVersionName: {
          Value: ["dcmjs"],
          vr: "SH"
        }
      };
      var _vrMap = {
        PixelData: "OW"
      };
      derivationSourceDataset._meta = _meta;
      derivationSourceDataset._vrMap = _vrMap;
      var report = new StructuredReport([derivationSourceDataset]);

      var contentItem = _MeasurementReport.contentItem(derivationSourceDataset); // Merge the derived dataset with the content from the Measurement Report


      report.dataset = Object.assign(report.dataset, contentItem);
      report.dataset._meta = _meta;
      return report;
    } //@ToDo

  }, {
    key: "generateToolState",
    value: function generateToolState(dataset) {
      // For now, bail out if the dataset is not a TID1500 SR with length measurements
      if (dataset.ContentTemplateSequence.TemplateIdentifier !== "1500") {
        throw new Error("This package can currently only interpret DICOM SR TID 1500");
      }

      var REPORT = "Imaging Measurements";
      var GROUP = "Measurement Group"; // Split the imagingMeasurementContent into measurement groups by their code meaning

      var imagingMeasurementContent = toArray(dataset.ContentSequence).find(codeMeaningEquals(REPORT)); // Retrieve the Measurements themselves

      var measurementGroups = toArray(imagingMeasurementContent.ContentSequence).filter(codeMeaningEquals(GROUP)); // // For each of the supported measurement types, compute the measurement data

      var measurementData = {};
      measurementGroups.forEach(function (mg) {
        Object.keys(MeasurementReport.MICROSCOPY_TOOL_CLASSES_BY_UTILITY_TYPE).forEach(function (measurementType) {
          // Find supported measurement types in the Structured Report
          var measurementGroupContentSequence = toArray(mg.ContentSequence);
          var measurementContent = measurementGroupContentSequence.filter(graphicTypeEquals(measurementType.toUpperCase()));

          if (!measurementContent || measurementContent.length === 0) {
            return;
          }

          var toolClass = MeasurementReport.MICROSCOPY_TOOL_CLASSES_BY_UTILITY_TYPE[measurementType];
          var toolType = toolClass.toolType;

          if (!toolClass.getMeasurementData) {
            throw new Error("MICROSCOPY Tool Adapters must define a getMeasurementData static method.");
          }

          if (!measurementData[toolType]) {
            measurementData[toolType] = [];
          }

          measurementData[toolType] = [].concat(_toConsumableArray(measurementData[toolType]), _toConsumableArray(toolClass.getMeasurementData(measurementContent)));
        });
      });
      return measurementData;
    }
  }, {
    key: "registerTool",
    value: function registerTool(toolClass) {
      MeasurementReport.MICROSCOPY_TOOL_CLASSES_BY_UTILITY_TYPE[toolClass.utilityToolType] = toolClass;
      MeasurementReport.MICROSCOPY_TOOL_CLASSES_BY_TOOL_TYPE[toolClass.graphicType] = toolClass;
      MeasurementReport.MEASUREMENT_BY_TOOLTYPE[toolClass.graphicType] = toolClass.utilityToolType;
    }
  }]);

  return MeasurementReport;
}();
MeasurementReport$1.MEASUREMENT_BY_TOOLTYPE = {};
MeasurementReport$1.MICROSCOPY_TOOL_CLASSES_BY_UTILITY_TYPE = {};
MeasurementReport$1.MICROSCOPY_TOOL_CLASSES_BY_TOOL_TYPE = {};

var Polyline = /*#__PURE__*/function () {
  function Polyline() {
    _classCallCheck(this, Polyline);
  }

  _createClass(Polyline, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(measurementContent) {
      // removing duplication and Getting only the graphicData information
      var measurement = measurementContent.map(function (item) {
        return item.GraphicData;
      }).filter(function (s) {
        return function (a) {
          return function (j) {
            return !s.has(j) && s.add(j);
          }(JSON.stringify(a));
        };
      }(new Set())); // Chunking the array into size of three

      return measurement.map(function (measurement) {
        return measurement.reduce(function (all, one, i) {
          var ch = Math.floor(i / 3);
          all[ch] = [].concat(all[ch] || [], one);
          return all;
        }, []);
      });
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(scoord3d) {
      if (scoord3d.graphicType !== "POLYLINE") {
        throw new Error("We expected a POLYLINE graphicType");
      }

      var points = scoord3d.graphicData;
      var lengths = 1;
      return {
        points: points,
        lengths: lengths
      };
    }
  }]);

  return Polyline;
}();

Polyline.graphicType = "POLYLINE";
Polyline.toolType = "Polyline";
Polyline.utilityToolType = "Polyline";
Polyline.TID300Representation = Polyline$1;
MeasurementReport$1.registerTool(Polyline);

/**
 * Expand an array of points stored as objects into
 * a flattened array of points
 *
 * @param points [{x: 0, y: 1}, {x: 1, y: 2}] or [{x: 0, y: 1, z: 0}, {x: 1, y: 2, z: 0}]
 * @return {Array} [point1x, point1y, point2x, point2y] or [point1x, point1y, point1z, point2x, point2y, point2z]
 */

function expandPoints(points) {
  var allPoints = [];
  points.forEach(function (point) {
    allPoints.push(point[0]);
    allPoints.push(point[1]);

    if (point[2] !== undefined) {
      allPoints.push(point[2]);
    }
  });
  return allPoints;
}

var Polygon$1 = /*#__PURE__*/function (_TID300Measurement) {
  _inherits(Polygon, _TID300Measurement);

  var _super = _createSuper(Polygon);

  function Polygon() {
    _classCallCheck(this, Polygon);

    return _super.apply(this, arguments);
  }

  _createClass(Polygon, [{
    key: "contentItem",
    value: function contentItem() {
      var _this$props = this.props,
          points = _this$props.points,
          perimeter = _this$props.perimeter,
          _this$props$unit = _this$props.unit,
          unit = _this$props$unit === void 0 ? "mm" : _this$props$unit,
          area = _this$props.area,
          areaUnit = _this$props.areaUnit,
          ReferencedSOPSequence = _this$props.ReferencedSOPSequence,
          _this$props$use3DSpat = _this$props.use3DSpatialCoordinates,
          use3DSpatialCoordinates = _this$props$use3DSpat === void 0 ? false : _this$props$use3DSpat;
      var GraphicData = expandPoints(points);
      return this.getMeasurement([{
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "G-A197",
          CodingSchemeDesignator: "SRT",
          CodeMeaning: "Perimeter"
        },
        MeasuredValueSequence: {
          MeasurementUnitsCodeSequence: unit2CodingValue(unit),
          NumericValue: perimeter
        },
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: use3DSpatialCoordinates ? "SCOORD3D" : "SCOORD",
          GraphicType: "POLYGON",
          GraphicData: GraphicData,
          ContentSequence: use3DSpatialCoordinates ? undefined : {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }, {
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "G-A166",
          CodingSchemeDesignator: "SRT",
          CodeMeaning: "Area"
        },
        MeasuredValueSequence: {
          MeasurementUnitsCodeSequence: unit2CodingValue(areaUnit),
          NumericValue: area
        },
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: use3DSpatialCoordinates ? "SCOORD3D" : "SCOORD",
          GraphicType: "POLYGON",
          GraphicData: GraphicData,
          ContentSequence: use3DSpatialCoordinates ? undefined : {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }]);
    }
  }]);

  return Polygon;
}(TID300Measurement);

var Polygon = /*#__PURE__*/function () {
  function Polygon() {
    _classCallCheck(this, Polygon);
  }

  _createClass(Polygon, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(measurementContent) {
      // removing duplication and Getting only the graphicData information
      var measurement = measurementContent.map(function (item) {
        return item.GraphicData;
      }).filter(function (s) {
        return function (a) {
          return function (j) {
            return !s.has(j) && s.add(j);
          }(JSON.stringify(a));
        };
      }(new Set())); // Chunking the array into size of three

      return measurement.map(function (measurement) {
        return measurement.reduce(function (all, one, i) {
          var ch = Math.floor(i / 3);
          all[ch] = [].concat(all[ch] || [], one);
          return all;
        }, []);
      });
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(scoord3d) {
      if (scoord3d.graphicType !== "POLYGON") {
        throw new Error("We expected a POLYGON graphicType");
      }

      var points = scoord3d.graphicData;
      var lengths = 1;
      return {
        points: points,
        lengths: lengths
      };
    }
  }]);

  return Polygon;
}();

Polygon.graphicType = "POLYGON";
Polygon.toolType = "Polygon";
Polygon.utilityToolType = "Polygon";
Polygon.TID300Representation = Polygon$1;
MeasurementReport$1.registerTool(Polygon);

var Point = /*#__PURE__*/function () {
  function Point() {
    _classCallCheck(this, Point);
  }

  _createClass(Point, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(measurementContent) {
      var measurement = measurementContent.map(function (item) {
        return item.GraphicData;
      });
      return measurement.filter(function (s) {
        return function (a) {
          return function (j) {
            return !s.has(j) && s.add(j);
          }(JSON.stringify(a));
        };
      }(new Set()));
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(scoord3d) {
      if (scoord3d.graphicType !== "POINT") {
        throw new Error("We expected a POINT graphicType");
      }

      var points = [scoord3d.graphicData];
      var lengths = 1;
      return {
        points: points,
        lengths: lengths
      };
    }
  }]);

  return Point;
}();

Point.graphicType = "POINT";
Point.toolType = "Point";
Point.utilityToolType = "Point";
Point.TID300Representation = Point$1;
MeasurementReport$1.registerTool(Point);

var Circle = /*#__PURE__*/function () {
  function Circle() {
    _classCallCheck(this, Circle);
  }

  _createClass(Circle, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(measurementContent) {
      // removing duplication and Getting only the graphicData information
      var measurement = measurementContent.map(function (item) {
        return item.GraphicData;
      }).filter(function (s) {
        return function (a) {
          return function (j) {
            return !s.has(j) && s.add(j);
          }(JSON.stringify(a));
        };
      }(new Set())); // Chunking the array into size of three

      return measurement.map(function (measurement) {
        return measurement.reduce(function (all, one, i) {
          var ch = Math.floor(i / 3);
          all[ch] = [].concat(all[ch] || [], one);
          return all;
        }, []);
      });
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(scoord3d) {
      if (scoord3d.graphicType !== "CIRCLE") {
        throw new Error("We expected a CIRCLE graphicType");
      }

      var points = scoord3d.graphicData;
      var lengths = 1;
      return {
        points: points,
        lengths: lengths
      };
    }
  }]);

  return Circle;
}();

Circle.graphicType = "CIRCLE";
Circle.toolType = "Circle";
Circle.utilityToolType = "Circle";
Circle.TID300Representation = Circle$1;
MeasurementReport$1.registerTool(Circle);

var Ellipse = /*#__PURE__*/function () {
  function Ellipse() {
    _classCallCheck(this, Ellipse);
  }

  _createClass(Ellipse, null, [{
    key: "getMeasurementData",
    value: function getMeasurementData(measurementContent) {
      // removing duplication and Getting only the graphicData information
      var measurement = measurementContent.map(function (item) {
        return item.GraphicData;
      }).filter(function (s) {
        return function (a) {
          return function (j) {
            return !s.has(j) && s.add(j);
          }(JSON.stringify(a));
        };
      }(new Set())); // Chunking the array into size of three

      return measurement.map(function (measurement) {
        return measurement.reduce(function (all, one, i) {
          var ch = Math.floor(i / 3);
          all[ch] = [].concat(all[ch] || [], one);
          return all;
        }, []);
      });
    }
  }, {
    key: "getTID300RepresentationArguments",
    value: function getTID300RepresentationArguments(scoord3d) {
      if (scoord3d.graphicType !== "Ellipse") {
        throw new Error("We expected a Ellipse graphicType");
      }

      var points = scoord3d.graphicData;
      var lengths = 1;
      return {
        points: points,
        lengths: lengths
      };
    }
  }]);

  return Ellipse;
}();

Ellipse.graphicType = "ELLIPSE";
Ellipse.toolType = "Ellipse";
Ellipse.utilityToolType = "Ellipse";
Ellipse.TID300Representation = Ellipse$1;
MeasurementReport$1.registerTool(Ellipse);

var DICOMMicroscopyViewer = {
  Polyline: Polyline,
  Polygon: Polygon,
  Point: Point,
  Circle: Circle,
  Ellipse: Ellipse,
  MeasurementReport: MeasurementReport$1
};

var adapters = {
  Cornerstone: Cornerstone,
  Cornerstone3D: Cornerstone3D,
  VTKjs: VTKjs,
  DICOMMicroscopyViewer: DICOMMicroscopyViewer
};

var TID1500 = {
  TID1500MeasurementReport: TID1500MeasurementReport,
  TID1501MeasurementGroup: TID1501MeasurementGroup
};

var Calibration = /*#__PURE__*/function (_TID300Measurement) {
  _inherits(Calibration, _TID300Measurement);

  var _super = _createSuper(Calibration);

  function Calibration() {
    _classCallCheck(this, Calibration);

    return _super.apply(this, arguments);
  }

  _createClass(Calibration, [{
    key: "contentItem",
    value: function contentItem() {
      var _this$props = this.props,
          point1 = _this$props.point1,
          point2 = _this$props.point2,
          _this$props$unit = _this$props.unit,
          unit = _this$props$unit === void 0 ? "mm" : _this$props$unit,
          distance = _this$props.distance,
          ReferencedSOPSequence = _this$props.ReferencedSOPSequence;
      return this.getMeasurement([{
        RelationshipType: "CONTAINS",
        ValueType: "NUM",
        ConceptNameCodeSequence: {
          CodeValue: "102304005",
          CodingSchemeDesignator: "SCT",
          CodeMeaning: "Calibration Ruler"
        },
        MeasuredValueSequence: {
          MeasurementUnitsCodeSequence: unit2CodingValue(unit),
          NumericValue: distance
        },
        ContentSequence: {
          RelationshipType: "INFERRED FROM",
          ValueType: "SCOORD",
          GraphicType: "POLYLINE",
          GraphicData: [point1.x, point1.y, point2.x, point2.y],
          ContentSequence: {
            RelationshipType: "SELECTED FROM",
            ValueType: "IMAGE",
            ReferencedSOPSequence: ReferencedSOPSequence
          }
        }
      }]);
    }
  }]);

  return Calibration;
}(TID300Measurement);

// - Cornerstone Probe
// Note: OHIF currently uses Cornerstone's 'dragProbe'. We need to add the regular Probe tool, which drops a single point.
//
// Hierarchy
// TID 1500 MeasurementReport
// --TID 1501 Measurement Group
// ---Measurement Group (DCM 125007)
// ----TID 300 Measurement
// ------SCOORD. Graphic Type: POINT
//
//
// - Cornerstone Ellipse:
//
// Should specify the Mean Modality Pixel Value measured in whatever units the image is in
// Should specify the Standard Deviation Modality Pixel Value measured in whatever units the image is in
//
//
// - Cornerstone Rectangle ROI
//
// Hierarchy
// TID 1500 MeasurementReport
// --TID 1501 Measurement Group
// ---Measurement Group (DCM 125007)
// ----TID 300 Measurement
// ------SCOORD. Graphic Type: POLYLINE
// ------ Use concept corresponding to Rectangle measurement
//
//                 http://dicom.nema.org/medical/dicom/current/output/html/part16.html#sect_TID_4019
//
// OR
// Note: This should be the same as a Freehand ROI, more or less. We add a TID 4019: Algorithm Identification flag to specify that this was created (and should be rehydrated) into a Rectangle ROI.
// TODO: Should we use a Derivation instead? http://dicom.nema.org/medical/dicom/current/output/html/part16.html#DCM_121401
// Should specify the Area measured in mmˆ2, including the units in UCUM
// Should specify the Mean Modality Pixel Value measured in whatever units the image is in
// Should specify the Standard Deviation Modality Pixel Value measured in whatever units the image is in
//
//
// - Cornerstone Simple Angle tool
//
// Hierarchy
// TID 1500 MeasurementReport
// --TID 1501 Measurement Group
// ---Measurement Group (DCM 125007)
// ----TID 300 Measurement
// ------SCOORD. Graphic Type: POLYLINE
//        (ftp://dicom.nema.org/MEDICAL/dicom/current/output/chtml/part03/sect_C.10.5.html)
// ----TID 300 Measurement
// ------SCOORD. Graphic Type: POLYLINE
//        (ftp://dicom.nema.org/MEDICAL/dicom/current/output/chtml/part03/sect_C.10.5.html)
//
// ------ Use concept corresponding to Angle measurement
//
// Two lines specify the angle
// Should specify the Angle measured in Degrees, including the units in UCUM
//

var TID300 = {
  TID300Measurement: TID300Measurement,
  Point: Point$1,
  Length: Length$2,
  CobbAngle: CobbAngle$1,
  Bidirectional: Bidirectional$2,
  Polyline: Polyline$1,
  Polygon: Polygon$1,
  Ellipse: Ellipse$1,
  Circle: Circle$1,
  Calibration: Calibration,
  unit2CodingValue: unit2CodingValue
};

/**
 * Converts a Uint8Array to a String.
 * @param {Uint8Array} array that should be converted
 * @param {Number} offset array offset in case only subset of array items should be extracted (default: 0)
 * @param {Number} limit maximum number of array items that should be extracted (defaults to length of array)
 * @returns {String}
 */
function uint8ArrayToString(arr, offset, limit) {
  offset = offset || 0;
  limit = limit || arr.length - offset;
  var str = "";

  for (var i = offset; i < offset + limit; i++) {
    str += String.fromCharCode(arr[i]);
  }

  return str;
}
/**
 * Converts a String to a Uint8Array.
 * @param {String} str string that should be converted
 * @returns {Uint8Array}
 */


function stringToUint8Array(str) {
  var arr = new Uint8Array(str.length);

  for (var i = 0, j = str.length; i < j; i++) {
    arr[i] = str.charCodeAt(i);
  }

  return arr;
}
/**
 * Identifies the boundary in a multipart/related message header.
 * @param {String} header message header
 * @returns {String} boundary
 */


function identifyBoundary(header) {
  var parts = header.split("\r\n");

  for (var i = 0; i < parts.length; i++) {
    if (parts[i].substr(0, 2) === "--") {
      return parts[i];
    }
  }
}
/**
 * Checks whether a given token is contained by a message at a given offset.
 * @param {Uint8Array} message message content
 * @param {Uint8Array} token substring that should be present
 * @param {Number} offset offset in message content from where search should start
 * @returns {Boolean} whether message contains token at offset
 */


function containsToken(message, token) {
  var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

  if (offset + token.length > message.length) {
    return false;
  }

  var index = offset;

  for (var i = 0; i < token.length; i++) {
    if (token[i] !== message[index++]) {
      return false;
    }
  }

  return true;
}
/**
 * Finds a given token in a message at a given offset.
 * @param {Uint8Array} message message content
 * @param {Uint8Array} token substring that should be found
 * @param {Number} offset message body offset from where search should start
 * @returns {Boolean} whether message has a part at given offset or not
 */


function findToken(message, token) {
  var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
  var maxSearchLength = arguments.length > 3 ? arguments[3] : undefined;
  var searchLength = message.length;

  if (maxSearchLength) {
    searchLength = Math.min(offset + maxSearchLength, message.length);
  }

  for (var i = offset; i < searchLength; i++) {
    // If the first value of the message matches
    // the first value of the token, check if
    // this is the full token.
    if (message[i] === token[0]) {
      if (containsToken(message, token, i)) {
        return i;
      }
    }
  }

  return -1;
}
/**
 * @typedef {Object} MultipartEncodedData
 * @property {ArrayBuffer} data The encoded Multipart Data
 * @property {String} boundary The boundary used to divide pieces of the encoded data
 */

/**
 * Encode one or more DICOM datasets into a single body so it can be
 * sent using the Multipart Content-Type.
 *
 * @param {ArrayBuffer[]} datasets Array containing each file to be encoded in the multipart body, passed as ArrayBuffers.
 * @param {String} [boundary] Optional string to define a boundary between each part of the multipart body. If this is not specified, a random GUID will be generated.
 * @return {MultipartEncodedData} The Multipart encoded data returned as an Object. This contains both the data itself, and the boundary string used to divide it.
 */


function multipartEncode(datasets) {
  var boundary = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : guid();
  var contentType = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "application/dicom";
  var contentTypeString = "Content-Type: ".concat(contentType);
  var header = "\r\n--".concat(boundary, "\r\n").concat(contentTypeString, "\r\n\r\n");
  var footer = "\r\n--".concat(boundary, "--");
  var headerArray = stringToUint8Array(header);
  var footerArray = stringToUint8Array(footer);
  var headerLength = headerArray.length;
  var footerLength = footerArray.length;
  var length = 0; // Calculate the total length for the final array

  var contentArrays = datasets.map(function (datasetBuffer) {
    var contentArray = new Uint8Array(datasetBuffer);
    var contentLength = contentArray.length;
    length += headerLength + contentLength + footerLength;
    return contentArray;
  }); // Allocate the array

  var multipartArray = new Uint8Array(length); // Set the initial header

  multipartArray.set(headerArray, 0); // Write each dataset into the multipart array

  var position = 0;
  contentArrays.forEach(function (contentArray) {
    contentArray.length;
    multipartArray.set(headerArray, position);
    multipartArray.set(contentArray, position + headerLength);
    position += headerLength + contentArray.length;
  });
  multipartArray.set(footerArray, position);
  return {
    data: multipartArray.buffer,
    boundary: boundary
  };
}
/**
 * Decode a Multipart encoded ArrayBuffer and return the components as an Array.
 *
 * @param {ArrayBuffer} response Data encoded as a 'multipart/related' message
 * @returns {Array} The content
 */


function multipartDecode(response) {
  var message = new Uint8Array(response);
  /* Set a maximum length to search for the header boundaries, otherwise
     findToken can run for a long time
  */

  var maxSearchLength = 1000; // First look for the multipart mime header

  var separator = stringToUint8Array("\r\n\r\n");
  var headerIndex = findToken(message, separator, 0, maxSearchLength);

  if (headerIndex === -1) {
    throw new Error("Response message has no multipart mime header");
  }

  var header = uint8ArrayToString(message, 0, headerIndex);
  var boundaryString = identifyBoundary(header);

  if (!boundaryString) {
    throw new Error("Header of response message does not specify boundary");
  }

  var boundary = stringToUint8Array(boundaryString);
  boundary.length;
  var components = [];
  var offset = headerIndex + separator.length; // Loop until we cannot find any more boundaries

  var boundaryIndex;

  while (boundaryIndex !== -1) {
    // Search for the next boundary in the message, starting
    // from the current offset position
    boundaryIndex = findToken(message, boundary, offset); // If no further boundaries are found, stop here.

    if (boundaryIndex === -1) {
      break;
    } // Extract data from response message, excluding "\r\n"


    var spacingLength = 2;
    var length = boundaryIndex - offset - spacingLength;
    var data = response.slice(offset, offset + length); // Add the data to the array of results

    components.push(data); // find the end of the boundary

    var boundaryEnd = findToken(message, separator, boundaryIndex + 1, maxSearchLength);
    if (boundaryEnd === -1) break; // Move the offset to the end of the identified boundary

    offset = boundaryEnd + separator.length;
  }

  return components;
}
/**
 * Create a random GUID
 *
 * @return {string}
 */


function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4();
}

var message = {
  containsToken: containsToken,
  findToken: findToken,
  identifyBoundary: identifyBoundary,
  uint8ArrayToString: uint8ArrayToString,
  stringToUint8Array: stringToUint8Array,
  multipartEncode: multipartEncode,
  multipartDecode: multipartDecode,
  guid: guid
};

var utilities = {
  TID1500: TID1500,
  TID300: TID300,
  message: message,
  addAccessors: addAccessors,
  orientation: orientation,
  compression: compression
};

var Code = /*#__PURE__*/function () {
  function Code(options) {
    _classCallCheck(this, Code);

    this[_value] = options.value;
    this[_meaning] = options.meaning;
    this[_schemeDesignator] = options.schemeDesignator;
    this[_schemeVersion] = options.schemeVersion || null;
  }

  _createClass(Code, [{
    key: "value",
    get: function get() {
      return this[_value];
    }
  }, {
    key: "meaning",
    get: function get() {
      return this[_meaning];
    }
  }, {
    key: "schemeDesignator",
    get: function get() {
      return this[_schemeDesignator];
    }
  }, {
    key: "schemeVersion",
    get: function get() {
      return this[_schemeVersion];
    }
  }]);

  return Code;
}();

var CodedConcept = /*#__PURE__*/function () {
  function CodedConcept(options) {
    _classCallCheck(this, CodedConcept);

    if (options.value === undefined) {
      throw new Error("Option 'value' is required for CodedConcept.");
    }

    if (options.meaning === undefined) {
      throw new Error("Option 'meaning' is required for CodedConcept.");
    }

    if (options.schemeDesignator === undefined) {
      throw new Error("Option 'schemeDesignator' is required for CodedConcept.");
    }

    this.CodeValue = options.value;
    this.CodeMeaning = options.meaning;
    this.CodingSchemeDesignator = options.schemeDesignator;

    if ("schemeVersion" in options) {
      this.CodingSchemeVersion = options.schemeVersion;
    }
  }

  _createClass(CodedConcept, [{
    key: "equals",
    value: function equals(other) {
      if (other.value === this.value && other.schemeDesignator === this.schemeDesignator) {
        if (other.schemeVersion && this.schemeVersion) {
          return other.schemeVersion === this.schemeVersion;
        }

        return true;
      }

      return false;
    }
  }, {
    key: "value",
    get: function get() {
      return this.CodeValue;
    }
  }, {
    key: "meaning",
    get: function get() {
      return this.CodeMeaning;
    }
  }, {
    key: "schemeDesignator",
    get: function get() {
      return this.CodingSchemeDesignator;
    }
  }, {
    key: "schemeVersion",
    get: function get() {
      return this.CodingSchemeVersion;
    }
  }]);

  return CodedConcept;
}();

var coding = /*#__PURE__*/Object.freeze({
	__proto__: null,
	Code: Code,
	CodedConcept: CodedConcept
});

var ValueTypes = {
  CODE: "CODE",
  COMPOSITE: "COMPOSITE",
  CONTAINER: "CONTAINER",
  DATE: "DATE",
  DATETIME: "DATETIME",
  IMAGE: "IMAGE",
  NUM: "NUM",
  PNAME: "PNAME",
  SCOORD: "SCOORD",
  SCOORD3D: "SCOORD3D",
  TCOORD: "TCOORD",
  TEXT: "TEXT",
  TIME: "TIME",
  UIDREF: "UIDREF",
  WAVEFORM: "WAVEFORM"
};
Object.freeze(ValueTypes);
var GraphicTypes = {
  CIRCLE: "CIRCLE",
  ELLIPSE: "ELLIPSE",
  ELLIPSOID: "ELLIPSOID",
  MULTIPOINT: "MULTIPOINT",
  POINT: "POINT",
  POLYLINE: "POLYLINE"
};
Object.freeze(GraphicTypes);
var GraphicTypes3D = {
  ELLIPSE: "ELLIPSE",
  ELLIPSOID: "ELLIPSOID",
  MULTIPOINT: "MULTIPOINT",
  POINT: "POINT",
  POLYLINE: "POLYLINE",
  POLYGON: "POLYGON"
};
Object.freeze(GraphicTypes3D);
var TemporalRangeTypes = {
  BEGIN: "BEGIN",
  END: "END",
  MULTIPOINT: "MULTIPOINT",
  MULTISEGMENT: "MULTISEGMENT",
  POINT: "POINT",
  SEGMENT: "SEGMENT"
};
Object.freeze(TemporalRangeTypes);
var RelationshipTypes = {
  CONTAINS: "CONTAINS",
  HAS_ACQ_CONTENT: "HAS ACQ CONTENT",
  HAS_CONCEPT_MOD: "HAS CONCEPT MOD",
  HAS_OBS_CONTEXT: "HAS OBS CONTEXT",
  HAS_PROPERTIES: "HAS PROPERTIES",
  INFERRED_FROM: "INFERRED FROM",
  SELECTED_FROM: "SELECTED FROM"
};
Object.freeze(RelationshipTypes);
var PixelOriginInterpretations = {
  FRAME: "FRAME",
  VOLUME: "VOLUME"
};
Object.freeze(RelationshipTypes);

function isFloat(n) {
  return n === +n && n !== (n | 0);
}

function zeroPad(value) {
  return (value > 9 ? "" : "0") + value;
}

function TM(date) {
  // %H%M%S.%f
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();
  var milliseconds = date.getMilliseconds();
  return zeroPad(hours) + zeroPad(minutes) + zeroPad(seconds) + milliseconds;
}

function DA(date) {
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  return year + zeroPad(month) + zeroPad(day);
}

function DT(date) {
  return DA(date) + TM(date);
}

var ContentSequence$1 = /*#__PURE__*/function (_Array) {
  _inherits(ContentSequence, _Array);

  var _super = _createSuper(ContentSequence);

  function ContentSequence() {
    _classCallCheck(this, ContentSequence);

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _super.call.apply(_super, [this].concat(args));
  } // filterBy(options) {
  // }


  return _createClass(ContentSequence);
}( /*#__PURE__*/_wrapNativeSuper(Array));

var ContentItem = /*#__PURE__*/_createClass(function ContentItem(options) {
  _classCallCheck(this, ContentItem);

  if (options.name === undefined) {
    throw new Error("Option 'name' is required for ContentItem.");
  }

  if (options.name.constructor !== CodedConcept) {
    throw new Error("Option 'name' must have type CodedConcept.");
  }

  this.ConceptNameCodeSequence = [options.name];

  if (options.valueType === undefined) {
    throw new Error("Option 'valueType' is required for ContentItem.");
  }

  if (!(Object.values(ValueTypes).indexOf(options.valueType) !== -1)) {
    throw new Error("Invalid value type ".concat(options.valueType));
  }

  this.ValueType = options.valueType;

  if (options.relationshipType !== undefined) {
    if (!(Object.values(RelationshipTypes).indexOf(options.relationshipType) !== -1)) {
      throw new Error("Invalid relationship type ".concat(options.relationshipTypes));
    }

    this.RelationshipType = options.relationshipType;
  } // TODO: relationship type is required

} // getContentItems(options) {
//   // TODO: filter by name, value type and relationship type
//   return this.ContentSequence;
// }
);

var CodeContentItem = /*#__PURE__*/function (_ContentItem) {
  _inherits(CodeContentItem, _ContentItem);

  var _super2 = _createSuper(CodeContentItem);

  function CodeContentItem(options) {
    var _this;

    _classCallCheck(this, CodeContentItem);

    _this = _super2.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.CODE
    });

    if (options.value === undefined) {
      throw new Error("Option 'value' is required for CodeContentItem.");
    }

    if (!(options.value || options.value.constructor === CodedConcept)) {
      throw new Error("Option 'value' must have type CodedConcept.");
    }

    _this.ConceptCodeSequence = [options.value];
    return _this;
  }

  return _createClass(CodeContentItem);
}(ContentItem);

var TextContentItem = /*#__PURE__*/function (_ContentItem2) {
  _inherits(TextContentItem, _ContentItem2);

  var _super3 = _createSuper(TextContentItem);

  function TextContentItem(options) {
    var _this2;

    _classCallCheck(this, TextContentItem);

    _this2 = _super3.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.TEXT
    });

    if (options.value === undefined) {
      throw new Error("Option 'value' is required for TextContentItem.");
    }

    if (!(typeof options.value === "string" || options.value instanceof String)) {
      throw new Error("Option 'value' must have type String.");
    }

    _this2.TextValue = options.value;
    return _this2;
  }

  return _createClass(TextContentItem);
}(ContentItem);

var PNameContentItem = /*#__PURE__*/function (_ContentItem3) {
  _inherits(PNameContentItem, _ContentItem3);

  var _super4 = _createSuper(PNameContentItem);

  function PNameContentItem(options) {
    var _this3;

    _classCallCheck(this, PNameContentItem);

    _this3 = _super4.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.PNAME
    });

    if (options.value === undefined) {
      throw new Error("Option 'value' is required for PNameContentItem.");
    }

    if (!(typeof options.value === "string" || options.value instanceof String)) {
      throw new Error("Option 'value' must have type String.");
    }

    _this3.PersonName = options.value;
    return _this3;
  }

  return _createClass(PNameContentItem);
}(ContentItem);

var TimeContentItem = /*#__PURE__*/function (_ContentItem4) {
  _inherits(TimeContentItem, _ContentItem4);

  var _super5 = _createSuper(TimeContentItem);

  function TimeContentItem(options) {
    var _this4;

    _classCallCheck(this, TimeContentItem);

    _this4 = _super5.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.TIME
    });

    if (options.value === undefined) {
      throw new Error("Option 'value' is required for TimeContentItem.");
    }

    if (!(_typeof(options.value) === "object" || options.value instanceof Date)) {
      throw new Error("Option 'value' must have type Date.");
    }

    _this4.Time = TM(options.value);
    return _this4;
  }

  return _createClass(TimeContentItem);
}(ContentItem);

var DateContentItem = /*#__PURE__*/function (_ContentItem5) {
  _inherits(DateContentItem, _ContentItem5);

  var _super6 = _createSuper(DateContentItem);

  function DateContentItem(options) {
    var _this5;

    _classCallCheck(this, DateContentItem);

    _this5 = _super6.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.DATE
    });

    if (options.value === undefined) {
      throw new Error("Option 'value' is required for DateContentItem.");
    }

    if (!(_typeof(options.value) === "object" || options.value instanceof Date)) {
      throw new Error("Option 'value' must have type Date.");
    }

    _this5.Date = DA(options.value);
    return _this5;
  }

  return _createClass(DateContentItem);
}(ContentItem);

var DateTimeContentItem = /*#__PURE__*/function (_ContentItem6) {
  _inherits(DateTimeContentItem, _ContentItem6);

  var _super7 = _createSuper(DateTimeContentItem);

  function DateTimeContentItem(options) {
    var _this6;

    _classCallCheck(this, DateTimeContentItem);

    _this6 = _super7.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.DATETIME
    });

    if (options.value === undefined) {
      throw new Error("Option 'value' is required for DateTimeContentItem.");
    }

    if (!(_typeof(options.value) === "object" || options.value instanceof Date)) {
      throw new Error("Option 'value' must have type Date.");
    }

    _this6.DateTime = DT(otions.value);
    return _this6;
  }

  return _createClass(DateTimeContentItem);
}(ContentItem);

var UIDRefContentItem = /*#__PURE__*/function (_ContentItem7) {
  _inherits(UIDRefContentItem, _ContentItem7);

  var _super8 = _createSuper(UIDRefContentItem);

  function UIDRefContentItem(options) {
    var _this7;

    _classCallCheck(this, UIDRefContentItem);

    _this7 = _super8.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.UIDREF
    });

    if (options.value === undefined) {
      throw new Error("Option 'value' is required for UIDRefContentItem.");
    }

    if (!(typeof options.value === "string" || options.value instanceof String)) {
      throw new Error("Option 'value' must have type String.");
    }

    _this7.UID = options.value;
    return _this7;
  }

  return _createClass(UIDRefContentItem);
}(ContentItem);

var NumContentItem = /*#__PURE__*/function (_ContentItem8) {
  _inherits(NumContentItem, _ContentItem8);

  var _super9 = _createSuper(NumContentItem);

  function NumContentItem(options) {
    var _this8;

    _classCallCheck(this, NumContentItem);

    _this8 = _super9.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.NUM
    });

    if (options.value !== undefined) {
      if (!(typeof options.value === "number" || options.value instanceof Number)) {
        throw new Error("Option 'value' must have type Number.");
      }

      if (options.unit === undefined) {
        throw new Error("Option 'unit' is required for NumContentItem with 'value'.");
      }

      if (options.unit.constructor !== CodedConcept) {
        throw new Error("Option 'unit' must have type CodedConcept.");
      }

      var item = {};
      item.NumericValue = options.value;

      if (isFloat(options.value)) {
        item.FloatingPointValue = options.value;
      }

      item.MeasurementUnitsCodeSequence = [options.unit];
      _this8.MeasuredValueSequence = [item];
    } else if (options.qualifier !== undefined) {
      if (!(options.qualifier || options.qualifier.constructor === CodedConcept)) {
        throw new Error("Option 'qualifier' must have type CodedConcept.");
      }

      _this8.NumericValueQualifierCodeSequence = [options.qualifier];
    } else {
      throw new Error("Either option 'value' or 'qualifier' is required for NumContentItem.");
    }

    return _this8;
  }

  return _createClass(NumContentItem);
}(ContentItem);

var ContainerContentItem = /*#__PURE__*/function (_ContentItem9) {
  _inherits(ContainerContentItem, _ContentItem9);

  var _super10 = _createSuper(ContainerContentItem);

  function ContainerContentItem(options) {
    var _this9;

    _classCallCheck(this, ContainerContentItem);

    _this9 = _super10.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.CONTAINER
    });

    if (options.isContentContinuous !== undefined) {
      _this9.ContinuityOfContent = "CONTINUOUS";
    } else {
      _this9.ContinuityOfContent = "SEPARATE";
    }

    if (options.templateID !== undefined) {
      if (!(typeof options.templateID === "string" || options.templateID instanceof String)) {
        throw new Error("Option 'templateID' must have type String.");
      }

      var item = {};
      item.MappingResource = "DCMR";
      item.TemplateIdentifier = options.templateID;
      _this9.ContentTemplateSequence = [item];
    }

    return _this9;
  }

  return _createClass(ContainerContentItem);
}(ContentItem);

var CompositeContentItem = /*#__PURE__*/function (_ContentItem10) {
  _inherits(CompositeContentItem, _ContentItem10);

  var _super11 = _createSuper(CompositeContentItem);

  function CompositeContentItem(options) {
    var _this10;

    _classCallCheck(this, CompositeContentItem);

    _this10 = _super11.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.COMPOSITE
    });

    if (options.referencedSOPClassUID === undefined) {
      throw new Error("Option 'referencedSOPClassUID' is required for CompositeContentItem.");
    }

    if (options.referencedSOPInstanceUID === undefined) {
      throw new Error("Option 'referencedSOPInstanceUID' is required for CompositeContentItem.");
    }

    if (!(typeof options.referencedSOPClassUID === "string" || options.referencedSOPClassUID instanceof String)) {
      throw new Error("Option 'referencedSOPClassUID' must have type String.");
    }

    if (!(typeof options.referencedSOPInstanceUID === "string" || options.referencedSOPInstanceUID instanceof String)) {
      throw new Error("Option 'referencedSOPInstanceUID' must have type String.");
    }

    var item = {};
    item.ReferencedSOPClassUID = options.referencedSOPClassUID;
    item.ReferencedSOPInstanceUID = options.referencedSOPInstanceUID;
    _this10.ReferenceSOPSequence = [item];
    return _this10;
  }

  return _createClass(CompositeContentItem);
}(ContentItem);

var ImageContentItem = /*#__PURE__*/function (_ContentItem11) {
  _inherits(ImageContentItem, _ContentItem11);

  var _super12 = _createSuper(ImageContentItem);

  function ImageContentItem(options) {
    var _this11;

    _classCallCheck(this, ImageContentItem);

    _this11 = _super12.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.IMAGE
    });

    if (options.referencedSOPClassUID === undefined) {
      throw new Error("Option 'referencedSOPClassUID' is required for ImageContentItem.");
    }

    if (options.referencedSOPInstanceUID === undefined) {
      throw new Error("Option 'referencedSOPInstanceUID' is required for ImageContentItem.");
    }

    if (!(typeof options.referencedSOPClassUID === "string" || options.referencedSOPClassUID instanceof String)) {
      throw new Error("Option 'referencedSOPClassUID' must have type String.");
    }

    if (!(typeof options.referencedSOPInstanceUID === "string" || options.referencedSOPInstanceUID instanceof String)) {
      throw new Error("Option 'referencedSOPInstanceUID' must have type String.");
    }

    var item = {};
    item.ReferencedSOPClassUID = options.referencedSOPClassUID;
    item.ReferencedSOPInstanceUID = options.referencedSOPInstanceUID;

    if (options.referencedFrameNumbers !== undefined) {
      if (!(_typeof(options.referencedFrameNumbers) === "object" || options.referencedFrameNumbers instanceof Array)) {
        throw new Error("Option 'referencedFrameNumbers' must have type Array.");
      } // FIXME: value multiplicity


      item.ReferencedFrameNumber = options.referencedFrameNumbers;
    }

    if (options.referencedFrameSegmentNumber !== undefined) {
      if (!(_typeof(options.referencedSegmentNumbers) === "object" || options.referencedSegmentNumbers instanceof Array)) {
        throw new Error("Option 'referencedSegmentNumbers' must have type Array.");
      } // FIXME: value multiplicity


      item.ReferencedSegmentNumber = options.referencedSegmentNumbers;
    }

    _this11.ReferencedSOPSequence = [item];
    return _this11;
  }

  return _createClass(ImageContentItem);
}(ContentItem);

var ScoordContentItem = /*#__PURE__*/function (_ContentItem12) {
  _inherits(ScoordContentItem, _ContentItem12);

  var _super13 = _createSuper(ScoordContentItem);

  function ScoordContentItem(options) {
    var _this12;

    _classCallCheck(this, ScoordContentItem);

    _this12 = _super13.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.SCOORD
    });

    if (options.graphicType === undefined) {
      throw new Error("Option 'graphicType' is required for ScoordContentItem.");
    }

    if (!(typeof options.graphicType === "string" || options.graphicType instanceof String)) {
      throw new Error("Option 'graphicType' of ScoordContentItem must have type String.");
    }

    if (options.graphicData === undefined) {
      throw new Error("Option 'graphicData' is required for ScoordContentItem.");
    }

    if (!(_typeof(options.graphicData) === "object" || options.graphicData instanceof Array)) {
      throw new Error("Option 'graphicData' of ScoordContentItem must have type Array.");
    }

    if (Object.values(GraphicTypes).indexOf(options.graphicType) === -1) {
      throw new Error("Invalid graphic type '".concat(options.graphicType, "'."));
    }

    if (options.graphicData[0] instanceof Array) {
      options.graphicData = [].concat.apply([], options.graphicData);
    }

    _this12.GraphicData = options.graphicData;
    options.pixelOriginInterpretation = options.pixelOriginInterpretation || PixelOriginInterpretations.VOLUME;

    if (!(typeof options.pixelOriginInterpretation === "string" || options.pixelOriginInterpretation instanceof String)) {
      throw new Error("Option 'pixelOriginInterpretation' must have type String.");
    }

    if (Object.values(PixelOriginInterpretations).indexOf(options.pixelOriginInterpretation) === -1) {
      throw new Error("Invalid pixel origin interpretation '".concat(options.pixelOriginInterpretation, "'."));
    }

    if (options.fiducialUID !== undefined) {
      if (!(typeof options.fiducialUID === "string" || options.fiducialUID instanceof String)) {
        throw new Error("Option 'fiducialUID' must have type String.");
      }

      _this12.FiducialUID = options.fiducialUID;
    }

    return _this12;
  }

  return _createClass(ScoordContentItem);
}(ContentItem);

var Scoord3DContentItem = /*#__PURE__*/function (_ContentItem13) {
  _inherits(Scoord3DContentItem, _ContentItem13);

  var _super14 = _createSuper(Scoord3DContentItem);

  function Scoord3DContentItem(options) {
    var _this13;

    _classCallCheck(this, Scoord3DContentItem);

    _this13 = _super14.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.SCOORD3D
    });

    if (options.graphicType === undefined) {
      throw new Error("Option 'graphicType' is required for Scoord3DContentItem.");
    }

    if (!(typeof options.graphicType === "string" || options.graphicType instanceof String)) {
      throw new Error("Option 'graphicType' must have type String.");
    }

    if (options.graphicData === undefined) {
      throw new Error("Option 'graphicData' is required for Scoord3DContentItem.");
    }

    if (!(_typeof(options.graphicData) === "object" || options.graphicData instanceof Array)) {
      throw new Error("Option 'graphicData' must have type Array.");
    }

    if (Object.values(GraphicTypes3D).indexOf(options.graphicType) === -1) {
      throw new Error("Invalid graphic type '".concat(options.graphicType, "'."));
    }

    if (options.graphicData[0] instanceof Array) {
      options.graphicData = [].concat.apply([], options.graphicData);
    }

    _this13.GraphicType = options.graphicType;
    _this13.GraphicData = options.graphicData;

    if (options.frameOfReferenceUID === undefined) {
      throw new Error("Option 'frameOfReferenceUID' is required for Scoord3DContentItem.");
    }

    if (!(typeof options.frameOfReferenceUID === "string" || options.frameOfReferenceUID instanceof String)) {
      throw new Error("Option 'frameOfReferenceUID' must have type String.");
    }

    _this13.ReferencedFrameOfReferenceUID = options.frameOfReferenceUID;

    if ("fiducialUID" in options) {
      if (!(typeof options.fiducialUID === "string" || options.fiducialUID instanceof String)) {
        throw new Error("Option 'fiducialUID' must have type String.");
      }

      _this13.FiducialUID = fiducialUID;
    }

    return _this13;
  }

  return _createClass(Scoord3DContentItem);
}(ContentItem);

var TcoordContentItem = /*#__PURE__*/function (_ContentItem14) {
  _inherits(TcoordContentItem, _ContentItem14);

  var _super15 = _createSuper(TcoordContentItem);

  function TcoordContentItem(options) {
    var _this14;

    _classCallCheck(this, TcoordContentItem);

    _this14 = _super15.call(this, {
      name: options.name,
      relationshipType: options.relationshipType,
      valueType: ValueTypes.TCOORD
    });

    if (options.temporalRangeType === undefined) {
      throw new Error("Option 'temporalRangeType' is required for TcoordContentItem.");
    }

    if (Object.values(TemporalRangeTypes).indexOf(options.temporalRangeType) === -1) {
      throw new Error("Invalid temporal range type '".concat(options.temporalRangeType, "'."));
    }

    if (options.referencedSamplePositions === undefined) {
      if (!(_typeof(options.referencedSamplePositions) === "object" || options.referencedSamplePositions instanceof Array)) {
        throw new Error("Option 'referencedSamplePositions' must have type Array.");
      } // TODO: ensure values are integers


      _this14.ReferencedSamplePositions = options.referencedSamplePositions;
    } else if (options.referencedTimeOffsets === undefined) {
      if (!(_typeof(options.referencedTimeOffsets) === "object" || options.referencedTimeOffsets instanceof Array)) {
        throw new Error("Option 'referencedTimeOffsets' must have type Array.");
      } // TODO: ensure values are floats


      _this14.ReferencedTimeOffsets = options.referencedTimeOffsets;
    } else if (options.referencedDateTime === undefined) {
      if (!(_typeof(options.referencedDateTime) === "object" || options.referencedDateTime instanceof Array)) {
        throw new Error("Option 'referencedDateTime' must have type Array.");
      }

      _this14.ReferencedDateTime = options.referencedDateTime;
    } else {
      throw new Error("One of the following options is required for TcoordContentItem: " + "'referencedSamplePositions', 'referencedTimeOffsets', or " + "'referencedDateTime'.");
    }

    return _this14;
  }

  return _createClass(TcoordContentItem);
}(ContentItem);

var valueTypes = /*#__PURE__*/Object.freeze({
	__proto__: null,
	CodeContentItem: CodeContentItem,
	CompositeContentItem: CompositeContentItem,
	ContainerContentItem: ContainerContentItem,
	ContentSequence: ContentSequence$1,
	DateContentItem: DateContentItem,
	DateTimeContentItem: DateTimeContentItem,
	GraphicTypes: GraphicTypes,
	GraphicTypes3D: GraphicTypes3D,
	ImageContentItem: ImageContentItem,
	NumContentItem: NumContentItem,
	PNameContentItem: PNameContentItem,
	PixelOriginInterpretations: PixelOriginInterpretations,
	RelationshipTypes: RelationshipTypes,
	Scoord3DContentItem: Scoord3DContentItem,
	ScoordContentItem: ScoordContentItem,
	TcoordContentItem: TcoordContentItem,
	TemporalRangeTypes: TemporalRangeTypes,
	TextContentItem: TextContentItem,
	TimeContentItem: TimeContentItem,
	UIDRefContentItem: UIDRefContentItem,
	ValueTypes: ValueTypes
});

var LongitudinalTemporalOffsetFromEvent = /*#__PURE__*/function (_NumContentItem) {
  _inherits(LongitudinalTemporalOffsetFromEvent, _NumContentItem);

  var _super = _createSuper(LongitudinalTemporalOffsetFromEvent);

  function LongitudinalTemporalOffsetFromEvent(options) {
    var _this;

    _classCallCheck(this, LongitudinalTemporalOffsetFromEvent);

    _this = _super.call(this, {
      name: new CodedConcept({
        value: "128740",
        meaning: "Longitudinal Temporal Offset from Event",
        schemeDesignator: "DCM"
      }),
      value: options.value,
      unit: options.unit,
      relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
    });
    _this.ContentSequence = new ContentSequence$1();
    var item = new CodeContentItem({
      name: new CodedConcept({
        value: "128741",
        meaning: "Longitudinal Temporal Event Type",
        schemeDesignator: "DCM"
      }),
      value: options.eventType,
      relationshipType: RelationshipTypes.HAS_CONCEPT_MOD
    });

    _this.ContentSequence.push(item);

    return _this;
  }

  return _createClass(LongitudinalTemporalOffsetFromEvent);
}(NumContentItem);

var SourceImageForRegion = /*#__PURE__*/function (_ImageContentItem) {
  _inherits(SourceImageForRegion, _ImageContentItem);

  var _super2 = _createSuper(SourceImageForRegion);

  function SourceImageForRegion(options) {
    _classCallCheck(this, SourceImageForRegion);

    return _super2.call(this, {
      name: new CodedConcept({
        value: "121324",
        meaning: "Source Image",
        schemeDesignator: "DCM"
      }),
      referencedSOPClassUID: options.referencedSOPClassUID,
      referencedSOPInstanceUID: options.referencedSOPInstanceUID,
      referencedFrameNumbers: options.referencedFrameNumbers,
      relationshipType: RelationshipTypes.SELECTED_FROM
    });
  }

  return _createClass(SourceImageForRegion);
}(ImageContentItem);

var SourceImageForSegmentation = /*#__PURE__*/function (_ImageContentItem2) {
  _inherits(SourceImageForSegmentation, _ImageContentItem2);

  var _super3 = _createSuper(SourceImageForSegmentation);

  function SourceImageForSegmentation(options) {
    _classCallCheck(this, SourceImageForSegmentation);

    return _super3.call(this, {
      name: new CodedConcept({
        value: "121233",
        meaning: "Source Image for Segmentation",
        schemeDesignator: "DCM"
      }),
      referencedSOPClassUID: options.referencedSOPClassUID,
      referencedSOPInstanceUID: options.referencedSOPInstanceUID,
      referencedFrameNumbers: options.referencedFrameNumbers,
      relationshipType: RelationshipTypes.SELECTED_FROM
    });
  }

  return _createClass(SourceImageForSegmentation);
}(ImageContentItem);

var SourceSeriesForSegmentation = /*#__PURE__*/function (_UIDRefContentItem) {
  _inherits(SourceSeriesForSegmentation, _UIDRefContentItem);

  var _super4 = _createSuper(SourceSeriesForSegmentation);

  function SourceSeriesForSegmentation(options) {
    _classCallCheck(this, SourceSeriesForSegmentation);

    return _super4.call(this, {
      name: new CodedConcept({
        value: "121232",
        meaning: "Source Series for Segmentation",
        schemeDesignator: "DCM"
      }),
      value: options.referencedSeriesInstanceUID,
      relationshipType: RelationshipTypes.CONTAINS
    });
  }

  return _createClass(SourceSeriesForSegmentation);
}(UIDRefContentItem);

var ImageRegion = /*#__PURE__*/function (_ScoordContentItem) {
  _inherits(ImageRegion, _ScoordContentItem);

  var _super5 = _createSuper(ImageRegion);

  function ImageRegion(options) {
    var _this2;

    _classCallCheck(this, ImageRegion);

    _this2 = _super5.call(this, {
      name: new CodedConcept({
        value: "111030",
        meaning: "Image Region",
        schemeDesignator: "DCM"
      }),
      graphicType: options.graphicType,
      graphicData: options.graphicData,
      pixelOriginInterpretation: options.pixelOriginInterpretation,
      relationshipType: RelationshipTypes.CONTAINS
    });

    if (options.graphicType === GraphicTypes.MULTIPOINT) {
      throw new Error("Graphic type 'MULTIPOINT' is not valid for region.");
    }

    if (options.sourceImage === undefined) {
      throw Error("Option 'sourceImage' is required for ImageRegion.");
    }

    if (!(options.sourceImage || options.sourceImage.constructor === SourceImageForRegion)) {
      throw new Error("Option 'sourceImage' of ImageRegion must have type " + "SourceImageForRegion.");
    }

    _this2.ContentSequence = new ContentSequence$1();

    _this2.ContentSequence.push(options.sourceImage);

    return _this2;
  }

  return _createClass(ImageRegion);
}(ScoordContentItem);

var ImageRegion3D = /*#__PURE__*/function (_Scoord3DContentItem) {
  _inherits(ImageRegion3D, _Scoord3DContentItem);

  var _super6 = _createSuper(ImageRegion3D);

  function ImageRegion3D(options) {
    var _this3;

    _classCallCheck(this, ImageRegion3D);

    _this3 = _super6.call(this, {
      name: new CodedConcept({
        value: "111030",
        meaning: "Image Region",
        schemeDesignator: "DCM"
      }),
      graphicType: options.graphicType,
      graphicData: options.graphicData,
      frameOfReferenceUID: options.frameOfReferenceUID,
      relationshipType: RelationshipTypes.CONTAINS
    });

    if (options.graphicType === GraphicTypes3D.MULTIPOINT) {
      throw new Error("Graphic type 'MULTIPOINT' is not valid for region.");
    }

    if (options.graphicType === GraphicTypes3D.ELLIPSOID) {
      throw new Error("Graphic type 'ELLIPSOID' is not valid for region.");
    }

    return _this3;
  }

  return _createClass(ImageRegion3D);
}(Scoord3DContentItem);

var VolumeSurface = /*#__PURE__*/function (_Scoord3DContentItem2) {
  _inherits(VolumeSurface, _Scoord3DContentItem2);

  var _super7 = _createSuper(VolumeSurface);

  function VolumeSurface(options) {
    var _this4;

    _classCallCheck(this, VolumeSurface);

    _this4 = _super7.call(this, {
      name: new CodedConcept({
        value: "121231",
        meaning: "Volume Surface",
        schemeDesignator: "DCM"
      }),
      graphicType: options.graphicType,
      graphicData: options.graphicData,
      frameOfFeferenceUID: options.frameOfFeferenceUID,
      relationshipType: RelationshipTypes.CONTAINS
    });

    if (options.graphicType !== GraphicTypes3D.ELLIPSOID) {
      throw new Error("Graphic type for volume surface must be 'ELLIPSOID'.");
    }

    _this4.ContentSequence = new ContentSequence$1();

    if (options.sourceImages) {
      options.sourceImages.forEach(function (image) {
        if (!(image || image.constructor === SourceImageForRegion)) {
          throw new Error("Items of option 'sourceImages' of VolumeSurface " + "must have type SourceImageForRegion.");
        }

        _this4.ContentSequence.push(image);
      });
    } else if (options.sourceSeries) {
      if (!(options.sourceSeries || options.sourceSeries.constructor === SourceSeriesForRegion)) {
        throw new Error("Option 'sourceSeries' of VolumeSurface " + "must have type SourceSeriesForRegion.");
      }

      _this4.ContentSequence.push(options.sourceSeries);
    } else {
      throw new Error("One of the following two options must be provided: " + "'sourceImage' or 'sourceSeries'.");
    }

    return _this4;
  }

  return _createClass(VolumeSurface);
}(Scoord3DContentItem);

var ReferencedRealWorldValueMap = /*#__PURE__*/function (_CompositeContentItem) {
  _inherits(ReferencedRealWorldValueMap, _CompositeContentItem);

  var _super8 = _createSuper(ReferencedRealWorldValueMap);

  function ReferencedRealWorldValueMap(options) {
    _classCallCheck(this, ReferencedRealWorldValueMap);

    return _super8.call(this, {
      name: new CodedConcept({
        value: "126100",
        meaning: "Real World Value Map used for measurement",
        schemeDesignator: "DCM"
      }),
      referencedSOPClassUID: option.referencedSOPClassUID,
      referencedSOPInstanceUID: options.referencedSOPInstanceUID,
      relationshipType: RelationshipTypes.CONTAINS
    });
  }

  return _createClass(ReferencedRealWorldValueMap);
}(CompositeContentItem);

var FindingSite = /*#__PURE__*/function (_CodeContentItem) {
  _inherits(FindingSite, _CodeContentItem);

  var _super9 = _createSuper(FindingSite);

  function FindingSite(options) {
    var _this5;

    _classCallCheck(this, FindingSite);

    _this5 = _super9.call(this, {
      name: new CodedConcept({
        value: "363698007",
        meaning: "Finding Site",
        schemeDesignator: "SCT"
      }),
      value: options.anatomicLocation,
      relationshipType: RelationshipTypes.HAS_CONCEPT_MOD
    });
    _this5.ContentSequence = new ContentSequence$1();

    if (options.laterality) {
      var item = new CodeContentItem({
        name: new CodedConcept({
          value: "272741003",
          meaning: "Laterality",
          schemeDesignator: "SCT"
        }),
        value: options.laterality,
        relationshipType: RelationshipTypes.HAS_CONCEPT_MOD
      });

      _this5.ContentSequence.push(item);
    }

    if (options.topographicalModifier) {
      var _item = new CodeContentItem({
        name: new CodedConcept({
          value: "106233006",
          meaning: "Topographical Modifier",
          schemeDesignator: "SCT"
        }),
        value: options.topographicalModifier,
        relationshipType: RelationshipTypes.HAS_CONCEPT_MOD
      });

      _this5.ContentSequence.push(_item);
    }

    return _this5;
  }

  return _createClass(FindingSite);
}(CodeContentItem);

var ReferencedSegmentationFrame = /*#__PURE__*/function (_ContentSequence) {
  _inherits(ReferencedSegmentationFrame, _ContentSequence);

  var _super10 = _createSuper(ReferencedSegmentationFrame);

  function ReferencedSegmentationFrame(options) {
    var _this6;

    _classCallCheck(this, ReferencedSegmentationFrame);

    if (options.sopClassUID === undefined) {
      throw new Error("Option 'sopClassUID' is required for ReferencedSegmentationFrame.");
    }

    if (options.sopInstanceUID === undefined) {
      throw new Error("Option 'sopInstanceUID' is required for ReferencedSegmentationFrame.");
    }

    if (options.frameNumber === undefined) {
      throw new Error("Option 'frameNumber' is required for ReferencedSegmentationFrame.");
    }

    if (options.segmentNumber === undefined) {
      throw new Error("Option 'segmentNumber' is required for ReferencedSegmentationFrame.");
    }

    if (options.sourceImage === undefined) {
      throw new Error("Option 'sourceImage' is required for ReferencedSegmentationFrame.");
    }

    _this6 = _super10.call(this);
    var segmentationItem = ImageContentItem({
      name: new CodedConcept({
        value: "121214",
        meaning: "Referenced Segmentation Frame",
        schemeDesignator: "DCM"
      }),
      referencedSOPClassUid: options.sopClassUid,
      referencedSOPInstanceUid: options.sopInstanceUid,
      referencedFrameNumber: options.frameNumber,
      referencedSegmentNumber: options.segmentNumber
    });

    _this6.push(segmentationItem);

    if (options.sourceImage.constructor !== SourceImageForSegmentation) {
      throw new Error("Option 'sourceImage' must have type SourceImageForSegmentation.");
    }

    _this6.push(sourceImage);

    return _this6;
  }

  return _createClass(ReferencedSegmentationFrame);
}(ContentSequence$1);

var ReferencedSegmentation = /*#__PURE__*/function (_ContentSequence2) {
  _inherits(ReferencedSegmentation, _ContentSequence2);

  var _super11 = _createSuper(ReferencedSegmentation);

  function ReferencedSegmentation(options) {
    var _this7;

    _classCallCheck(this, ReferencedSegmentation);

    if (options.sopClassUID === undefined) {
      throw new Error("Option 'sopClassUID' is required for ReferencedSegmentation.");
    }

    if (options.sopInstanceUID === undefined) {
      throw new Error("Option 'sopInstanceUID' is required for ReferencedSegmentation.");
    }

    if (options.frameNumbers === undefined) {
      throw new Error("Option 'frameNumbers' is required for ReferencedSegmentation.");
    }

    if (options.segmentNumber === undefined) {
      throw new Error("Option 'segmentNumber' is required for ReferencedSegmentation.");
    }

    _this7 = _super11.call(this);
    var segmentationItem = new ImageContentItem({
      name: new CodedConcept({
        value: "121191",
        meaning: "Referenced Segment",
        schemeDesignator: "DCM"
      }),
      referencedSOPClassUid: options.sopClassUid,
      referencedSOPInstanceUid: options.sopInstanceUid,
      referencedFrameNumber: options.frameNumbers,
      referencedSegmentNumber: options.segmentNumber
    });

    _this7.push(segmentationItem);

    if (options.sourceImages !== undefined) {
      options.sourceImages.forEach(function (image) {
        if (!image || image.constructor !== SourceImageForSegmentation) {
          throw new Error("Items of option 'sourceImages' must have type " + "SourceImageForSegmentation.");
        }

        _this7.push(image);
      });
    } else if (options.sourceSeries !== undefined) {
      if (options.sourceSeries.constructor !== SourceSeriesForSegmentation) {
        throw new Error("Option 'sourceSeries' must have type SourceSeriesForSegmentation.");
      }

      _this7.push(sourceSeries);
    } else {
      throw new Error("One of the following two options must be provided: " + "'sourceImages' or 'sourceSeries'.");
    }

    return _this7;
  }

  return _createClass(ReferencedSegmentation);
}(ContentSequence$1);

var contentItems = /*#__PURE__*/Object.freeze({
	__proto__: null,
	FindingSite: FindingSite,
	ImageRegion: ImageRegion,
	ImageRegion3D: ImageRegion3D,
	LongitudinalTemporalOffsetFromEvent: LongitudinalTemporalOffsetFromEvent,
	ReferencedRealWorldValueMap: ReferencedRealWorldValueMap,
	ReferencedSegmentation: ReferencedSegmentation,
	ReferencedSegmentationFrame: ReferencedSegmentationFrame,
	SourceImageForRegion: SourceImageForRegion,
	SourceImageForSegmentation: SourceImageForSegmentation,
	SourceSeriesForSegmentation: SourceSeriesForSegmentation,
	VolumeSurface: VolumeSurface
});

var Template = /*#__PURE__*/function (_ContentSequence) {
  _inherits(Template, _ContentSequence);

  var _super = _createSuper(Template);

  function Template() {
    _classCallCheck(this, Template);

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _super.call.apply(_super, [this].concat(args));
  }

  return _createClass(Template);
}(ContentSequence$1);

var Measurement = /*#__PURE__*/function (_Template) {
  _inherits(Measurement, _Template);

  var _super2 = _createSuper(Measurement);

  function Measurement(options) {
    var _valueItem$ContentSeq;

    var _this;

    _classCallCheck(this, Measurement);

    _this = _super2.call(this);
    var valueItem = new NumContentItem({
      name: options.name,
      value: options.value,
      unit: options.unit,
      qualifier: options.qualifier,
      relationshipType: RelationshipTypes.CONTAINS
    });
    valueItem.ContentSequence = new ContentSequence$1();

    if (options.trackingIdentifier === undefined) {
      throw new Error("Option 'trackingIdentifier' is required for Measurement.");
    }

    if (options.trackingIdentifier.constructor === TrackingIdentifier) {
      throw new Error("Option 'trackingIdentifier' must have type TrackingIdentifier.");
    }

    (_valueItem$ContentSeq = valueItem.ContentSequence).push.apply(_valueItem$ContentSeq, _toConsumableArray(options.trackingIdentifier));

    if (options.method !== undefined) {
      var methodItem = new CodeContentItem({
        name: new CodedConcept({
          value: "370129005",
          meaning: "Measurement Method",
          schemeDesignator: "SCT"
        }),
        value: options.method,
        relationshipType: RelationshipTypes.HAS_CONCEPT_MOD
      });
      valueItem.ContentSequence.push(methodItem);
    }

    if (options.derivation !== undefined) {
      var derivationItem = new CodeContentItem({
        name: new CodedConcept({
          value: "121401",
          meaning: "Derivation",
          schemeDesignator: "DCM"
        }),
        value: options.derivation,
        relationshipType: RelationshipTypes.HAS_CONCEPT_MOD
      });
      valueItem.ContentSequence.push(derivationItem);
    }

    if (options.findingSites !== undefined) {
      if (!(_typeof(options.findingSites) === "object" || options.findingSites instanceof Array)) {
        throw new Error("Option 'findingSites' must have type Array.");
      }

      options.findingSites.forEach(function (site) {
        if (!site || site.constructor !== FindingSite) {
          throw new Error("Items of option 'findingSites' must have type FindingSite.");
        }

        valueItem.ContentSequence.push(site);
      });
    }

    if (options.properties !== undefined) {
      var _valueItem$ContentSeq2;

      if (options.properties.constructor !== MeasurementProperties) {
        throw new Error("Option 'properties' must have type MeasurementProperties.");
      }

      (_valueItem$ContentSeq2 = valueItem.ContentSequence).push.apply(_valueItem$ContentSeq2, _toConsumableArray(options.properties));
    }

    if (options.referencedRegions !== undefined) {
      if (!(_typeof(options.referencedRegions) === "object" || options.referencedRegions instanceof Array)) {
        throw new Error("Option 'referencedRegions' must have type Array.");
      }

      options.referencedRegions.forEach(function (region) {
        if (!region || region.constructor !== ImageRegion && region.constructor !== ImageRegion3D) {
          throw new Error("Items of option 'referencedRegion' must have type " + "ImageRegion or ImageRegion3D.");
        }

        valueItem.ContentSequence.push(region);
      });
    } else if (options.referencedVolume !== undefined) {
      if (options.referencedVolume.constructor !== VolumeSurface) {
        throw new Error("Option 'referencedVolume' must have type VolumeSurface.");
      }

      valueItem.ContentSequence.push(options.referencedVolume);
    } else if (options.referencedSegmentation !== undefined) {
      if (options.referencedSegmentation.constructor !== ReferencedSegmentation && options.referencedSegmentation.constructor !== ReferencedSegmentationFrame) {
        throw new Error("Option 'referencedSegmentation' must have type " + "ReferencedSegmentation or ReferencedSegmentationFrame.");
      }

      valueItem.ContentSequence.push(options.referencedSegmentation);
    }

    if (options.referencedRealWorldValueMap !== undefined) {
      if (options.referencedRealWorldValueMap.constructor !== ReferencedRealWorldValueMap) {
        throw new Error("Option 'referencedRealWorldValueMap' must have type " + "ReferencedRealWorldValueMap.");
      }

      valueItem.ContentSequence.push(options.referencedRealWorldValueMap);
    }

    if (options.algorithmId !== undefined) {
      var _valueItem$ContentSeq3;

      if (options.algorithmId.constructor !== AlgorithmIdentification) {
        throw new Error("Option 'algorithmId' must have type AlgorithmIdentification.");
      }

      (_valueItem$ContentSeq3 = valueItem.ContentSequence).push.apply(_valueItem$ContentSeq3, _toConsumableArray(options.algorithmId));
    }

    _this.push(valueItem);

    return _this;
  }

  return _createClass(Measurement);
}(Template);

var MeasurementProperties = /*#__PURE__*/function (_Template2) {
  _inherits(MeasurementProperties, _Template2);

  var _super3 = _createSuper(MeasurementProperties);

  function MeasurementProperties(options) {
    var _this2;

    _classCallCheck(this, MeasurementProperties);

    _this2 = _super3.call(this);

    if (options.normality !== undefined) {
      var normalityItem = new CodeContentItem({
        name: new CodedConcept({
          value: "121402",
          schemeDesignator: "DCM",
          meaning: "Normality"
        }),
        value: options.normality,
        relationshipType: RelationshipTypes.HAS_PROPERTIES
      });

      _this2.push(normalityItem);
    }

    if (options.measurementStatisticalProperties !== undefined) {
      var _this3;

      if (options.measurementStatisticalProperties.constructor !== MeasurementStatisticalProperties) {
        throw new Error("Option 'measurmentStatisticalProperties' must have type " + "MeasurementStatisticalProperties.");
      }

      (_this3 = _this2).push.apply(_this3, _toConsumableArray(measurementStatisticalProperties));
    }

    if (options.normalRangeProperties !== undefined) {
      var _this4;

      if (options.normalRangeProperties.constructor !== NormalRangeProperties) {
        throw new Error("Option 'normalRangeProperties' must have type NormalRangeProperties.");
      }

      (_this4 = _this2).push.apply(_this4, _toConsumableArray(normalRangeProperties));
    }

    if (options.levelOfSignificance !== undefined) {
      var levelOfSignificanceItem = new CodeContentItem({
        name: new CodedConcept({
          value: "121403",
          schemeDesignator: "DCM",
          meaning: "Level of Significance"
        }),
        value: options.levelOfSignificance,
        relationshipType: RelationshipTypes.HAS_PROPERTIES
      });

      _this2.push(levelOfSignificanceItem);
    }

    if (options.selectionStatus !== undefined) {
      var selectionStatusItem = new CodeContentItem({
        name: new CodedConcept({
          value: "121404",
          schemeDesignator: "DCM",
          meaning: "Selection Status"
        }),
        value: options.selectionStatus,
        relationshipType: RelationshipTypes.HAS_PROPERTIES
      });

      _this2.push(selectionStatusItem);
    }

    if (options.upperMeasurementUncertainty !== undefined) {
      var upperMeasurementUncertaintyItem = new CodeContentItem({
        name: new CodedConcept({
          value: "R-00364",
          schemeDesignator: "SRT",
          meaning: "Range of Upper Measurement Uncertainty"
        }),
        value: options.upperMeasurementUncertainty,
        relationshipType: RelationshipTypes.HAS_PROPERTIES
      });

      _this2.push(upperMeasurementUncertaintyItem);
    }

    if (options.lowerMeasurementUncertainty !== undefined) {
      var lowerMeasurementUncertaintyItem = new CodeContentItem({
        name: new CodedConcept({
          value: "R-00362",
          schemeDesignator: "SRT",
          meaning: "Range of Lower Measurement Uncertainty"
        }),
        value: options.lowerMeasurementUncertainty,
        relationshipType: RelationshipTypes.HAS_PROPERTIES
      });

      _this2.push(lowerMeasurementUncertaintyItem);
    }

    return _this2;
  }

  return _createClass(MeasurementProperties);
}(Template);

var MeasurementStatisticalProperties = /*#__PURE__*/function (_Template3) {
  _inherits(MeasurementStatisticalProperties, _Template3);

  var _super4 = _createSuper(MeasurementStatisticalProperties);

  function MeasurementStatisticalProperties(options) {
    var _this5;

    _classCallCheck(this, MeasurementStatisticalProperties);

    _this5 = _super4.call(this);

    if (options.values === undefined) {
      throw new Error("Option 'values' is required for MeasurementStatisticalProperties.");
    }

    if (!(_typeof(options.values) === "object" || options.values instanceof Array)) {
      throw new Error("Option 'values' must have type Array.");
    }

    options.values.forEach(function (value) {
      if (!options.concept || options.concept.constructor !== NumContentItem) {
        throw new Error("Items of option 'values' must have type NumContentItem.");
      }

      _this5.push(value);
    });

    if (options.description !== undefined) {
      new TextContentItem({
        name: new CodedConcept({
          value: "121405",
          schemeDesignator: "DCM",
          meaning: "Population Description"
        }),
        value: options.authority,
        relationshipType: RelationshipTypes.HAS_PROPERTIES
      });

      _this5.push(authorityItem);
    }

    if (options.authority !== undefined) {
      var _authorityItem = new TextContentItem({
        name: new CodedConcept({
          value: "121406",
          schemeDesignator: "DCM",
          meaning: "Population Authority"
        }),
        value: options.authority,
        relationshipType: RelationshipTypes.HAS_PROPERTIES
      });

      _this5.push(_authorityItem);
    }

    return _this5;
  }

  return _createClass(MeasurementStatisticalProperties);
}(Template);

var NormalRangeProperties = /*#__PURE__*/function (_Template4) {
  _inherits(NormalRangeProperties, _Template4);

  var _super5 = _createSuper(NormalRangeProperties);

  function NormalRangeProperties(options) {
    var _this6;

    _classCallCheck(this, NormalRangeProperties);

    _this6 = _super5.call(this);

    if (options.values === undefined) {
      throw new Error("Option 'values' is required for NormalRangeProperties.");
    }

    if (!(_typeof(options.values) === "object" || options.values instanceof Array)) {
      throw new Error("Option 'values' must have type Array.");
    }

    options.values.forEach(function (value) {
      if (!options.concept || options.concept.constructor !== NumContentItem) {
        throw new Error("Items of option 'values' must have type NumContentItem.");
      }

      _this6.push(value);
    });

    if (options.description !== undefined) {
      new TextContentItem({
        name: new CodedConcept({
          value: "121407",
          schemeDesignator: "DCM",
          meaning: "Normal Range Description"
        }),
        value: options.authority,
        relationshipType: RelationshipTypes.HAS_PROPERTIES
      });

      _this6.push(authorityItem);
    }

    if (options.authority !== undefined) {
      var _authorityItem2 = new TextContentItem({
        name: new CodedConcept({
          value: "121408",
          schemeDesignator: "DCM",
          meaning: "Normal Range Authority"
        }),
        value: options.authority,
        relationshipType: RelationshipTypes.HAS_PROPERTIES
      });

      _this6.push(_authorityItem2);
    }

    return _this6;
  }

  return _createClass(NormalRangeProperties);
}(Template);

var ObservationContext = /*#__PURE__*/function (_Template5) {
  _inherits(ObservationContext, _Template5);

  var _super6 = _createSuper(ObservationContext);

  function ObservationContext(options) {
    var _this8;

    var _this7;

    _classCallCheck(this, ObservationContext);

    _this7 = _super6.call(this);

    if (options.observerPersonContext === undefined) {
      throw new Error("Option 'observerPersonContext' is required for ObservationContext.");
    }

    if (options.observerPersonContext.constructor !== ObserverContext) {
      throw new Error("Option 'observerPersonContext' must have type ObserverContext");
    }

    (_this8 = _this7).push.apply(_this8, _toConsumableArray(options.observerPersonContext));

    if (options.observerDeviceContext !== undefined) {
      var _this9;

      if (options.observerDeviceContext.constructor !== ObserverContext) {
        throw new Error("Option 'observerDeviceContext' must have type ObserverContext");
      }

      (_this9 = _this7).push.apply(_this9, _toConsumableArray(options.observerDeviceContext));
    }

    if (options.subjectContext !== undefined) {
      var _this10;

      if (options.subjectContext.constructor !== SubjectContext) {
        throw new Error("Option 'subjectContext' must have type SubjectContext");
      }

      (_this10 = _this7).push.apply(_this10, _toConsumableArray(options.subjectContext));
    }

    return _this7;
  }

  return _createClass(ObservationContext);
}(Template);

var ObserverContext = /*#__PURE__*/function (_Template6) {
  _inherits(ObserverContext, _Template6);

  var _super7 = _createSuper(ObserverContext);

  function ObserverContext(options) {
    var _this12;

    var _this11;

    _classCallCheck(this, ObserverContext);

    _this11 = _super7.call(this);

    if (options.observerType === undefined) {
      throw new Error("Option 'observerType' is required for ObserverContext.");
    } else {
      if (options.observerType.constructor !== Code && options.observerType.constructor !== CodedConcept) {
        throw new Error("Option 'observerType' must have type Code or CodedConcept.");
      }
    }

    var observerTypeItem = new CodeContentItem({
      name: new CodedConcept({
        value: "121005",
        meaning: "Observer Type",
        schemeDesignator: "DCM"
      }),
      value: options.observerType,
      relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
    });

    _this11.push(observerTypeItem);

    if (options.observerIdentifyingAttributes === undefined) {
      throw new Error("Option 'observerIdentifyingAttributes' is required for ObserverContext.");
    } // FIXME


    var person = new CodedConcept({
      value: "121006",
      schemeDesignator: "DCM",
      meaning: "Person"
    });
    var device = new CodedConcept({
      value: "121007",
      schemeDesignator: "DCM",
      meaning: "Device"
    });

    if (person.equals(options.observerType)) {
      if (options.observerIdentifyingAttributes.constructor !== PersonObserverIdentifyingAttributes) {
        throw new Error("Option 'observerIdentifyingAttributes' must have type " + "PersonObserverIdentifyingAttributes for 'Person' observer type.");
      }
    } else if (device.equals(options.observerType)) {
      if (options.observerIdentifyingAttributes.constructor !== DeviceObserverIdentifyingAttributes) {
        throw new Error("Option 'observerIdentifyingAttributes' must have type " + "DeviceObserverIdentifyingAttributes for 'Device' observer type.");
      }
    } else {
      throw new Error("Option 'oberverType' must be either 'Person' or 'Device'.");
    }

    (_this12 = _this11).push.apply(_this12, _toConsumableArray(options.observerIdentifyingAttributes));

    return _this11;
  }

  return _createClass(ObserverContext);
}(Template);

var PersonObserverIdentifyingAttributes = /*#__PURE__*/function (_Template7) {
  _inherits(PersonObserverIdentifyingAttributes, _Template7);

  var _super8 = _createSuper(PersonObserverIdentifyingAttributes);

  function PersonObserverIdentifyingAttributes(options) {
    var _this13;

    _classCallCheck(this, PersonObserverIdentifyingAttributes);

    _this13 = _super8.call(this);

    if (options.name === undefined) {
      throw new Error("Option 'name' is required for PersonObserverIdentifyingAttributes.");
    }

    var nameItem = new PNameContentItem({
      name: new CodedConcept({
        value: "121008",
        meaning: "Person Observer Name",
        schemeDesignator: "DCM"
      }),
      value: options.name,
      relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
    });

    _this13.push(nameItem);

    if (options.loginName !== undefined) {
      var loginNameItem = new TextContentItem({
        name: new CodedConcept({
          value: "128774",
          meaning: "Person Observer's Login Name",
          schemeDesignator: "DCM"
        }),
        value: options.loginName,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this13.push(loginNameItem);
    }

    if (options.organizationName !== undefined) {
      var organizationNameItem = new TextContentItem({
        name: new CodedConcept({
          value: "121009",
          meaning: "Person Observer's Organization Name",
          schemeDesignator: "DCM"
        }),
        value: options.organizationName,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this13.push(organizationNameItem);
    }

    if (options.roleInOrganization !== undefined) {
      var roleInOrganizationItem = new CodeContentItem({
        name: new CodedConcept({
          value: "121010",
          meaning: "Person Observer's Role in the Organization",
          schemeDesignator: "DCM"
        }),
        value: options.roleInOrganization,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this13.push(roleInOrganizationItem);
    }

    if (options.roleInProcedure !== undefined) {
      var roleInProcedureItem = new CodeContentItem({
        name: new CodedConcept({
          value: "121011",
          meaning: "Person Observer's Role in this Procedure",
          schemeDesignator: "DCM"
        }),
        value: options.roleInProcedure,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this13.push(roleInProcedureItem);
    }

    return _this13;
  }

  return _createClass(PersonObserverIdentifyingAttributes);
}(Template);

var DeviceObserverIdentifyingAttributes = /*#__PURE__*/function (_Template8) {
  _inherits(DeviceObserverIdentifyingAttributes, _Template8);

  var _super9 = _createSuper(DeviceObserverIdentifyingAttributes);

  function DeviceObserverIdentifyingAttributes(options) {
    var _this14;

    _classCallCheck(this, DeviceObserverIdentifyingAttributes);

    _this14 = _super9.call(this);

    if (options.uid === undefined) {
      throw new Error("Option 'uid' is required for DeviceObserverIdentifyingAttributes.");
    }

    var deviceObserverItem = new UIDRefContentItem({
      name: new CodedConcept({
        value: "121012",
        meaning: "Device Observer UID",
        schemeDesignator: "DCM"
      }),
      value: options.uid,
      relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
    });

    _this14.push(deviceObserverItem);

    if (options.manufacturerName !== undefined) {
      var manufacturerNameItem = new TextContentItem({
        name: new CodedConcept({
          value: "121013",
          meaning: "Device Observer Manufacturer",
          schemeDesignator: "DCM"
        }),
        value: options.manufacturerName,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this14.push(manufacturerNameItem);
    }

    if (options.modelName !== undefined) {
      var modelNameItem = new TextContentItem({
        name: new CodedConcept({
          value: "121015",
          meaning: "Device Observer Model Name",
          schemeDesignator: "DCM"
        }),
        value: options.modelName,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this14.push(modelNameItem);
    }

    if (options.serialNumber !== undefined) {
      var serialNumberItem = new TextContentItem({
        name: new CodedConcept({
          value: "121016",
          meaning: "Device Observer Serial Number",
          schemeDesignator: "DCM"
        }),
        value: options.serialNumber,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this14.push(serialNumberItem);
    }

    if (options.physicalLocation !== undefined) {
      var physicalLocationItem = new TextContentItem({
        name: new CodedConcept({
          value: "121017",
          meaning: "Device Observer Physical Location During Observation",
          schemeDesignator: "DCM"
        }),
        value: options.physicalLocation,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this14.push(physicalLocationItem);
    }

    if (options.roleInProcedure !== undefined) {
      var roleInProcedureItem = new CodeContentItem({
        name: new CodedConcept({
          value: "113876",
          meaning: "Device Role in Procedure",
          schemeDesignator: "DCM"
        }),
        value: options.roleInProcedure,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this14.push(roleInProcedureItem);
    }

    return _this14;
  }

  return _createClass(DeviceObserverIdentifyingAttributes);
}(Template);

var SubjectContext = /*#__PURE__*/function (_Template9) {
  _inherits(SubjectContext, _Template9);

  var _super10 = _createSuper(SubjectContext);

  function SubjectContext(options) {
    var _this16;

    var _this15;

    _classCallCheck(this, SubjectContext);

    _this15 = _super10.call(this);

    if (options.subjectClass === undefined) {
      throw new Error("Option 'subjectClass' is required for SubjectContext.");
    }

    if (options.subjectClassSpecificContext === undefined) {
      throw new Error("Option 'subjectClassSpecificContext' is required for SubjectContext.");
    }

    var subjectClassItem = new CodeContentItem({
      name: new CodedConcept({
        value: "121024",
        meaning: "Subject Class",
        schemeDesignator: "DCM"
      }),
      value: options.subjectClass,
      relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
    });

    _this15.push(subjectClassItem);

    var fetus = new CodedConcept({
      value: "121026 ",
      schemeDesignator: "DCM",
      meaning: "Fetus"
    });
    var specimen = new CodedConcept({
      value: "121027",
      schemeDesignator: "DCM",
      meaning: "Specimen"
    });
    var device = new CodedConcept({
      value: "121192",
      schemeDesignator: "DCM",
      meaning: "Device Subject"
    });

    if (fetus.equals(options.subjectClass)) {
      if (options.subjectClassSpecificContext.constructor !== SubjectContextFetus) {
        throw new Error("Option 'subjectClass' must have type " + "SubjectContextFetus for 'Fetus' subject class.");
      }
    } else if (specimen.equals(options.subjectClass)) {
      if (options.subjectClassSpecificContext.constructor !== SubjectContextSpecimen) {
        throw new Error("Option 'subjectClass' must have type " + "SubjectContextSpecimen for 'Specimen' subject class.");
      }
    } else if (device.equals(options.subjectClass)) {
      if (options.subjectClassSpecificContext.constructor !== SubjectContextDevice) {
        throw new Error("Option 'subjectClass' must have type " + "SubjectContextDevice for 'Device' subject class.");
      }
    } else {
      throw new Error("Option 'subjectClass' must be either 'Fetus', 'Specimen', or 'Device'.");
    }

    (_this16 = _this15).push.apply(_this16, _toConsumableArray(options.subjectClassSpecificContext));

    return _this15;
  }

  return _createClass(SubjectContext);
}(Template);

var SubjectContextFetus = /*#__PURE__*/function (_Template10) {
  _inherits(SubjectContextFetus, _Template10);

  var _super11 = _createSuper(SubjectContextFetus);

  function SubjectContextFetus(options) {
    var _this17;

    _classCallCheck(this, SubjectContextFetus);

    _this17 = _super11.call(this);

    if (options.subjectID === undefined) {
      throw new Error("Option 'subjectID' is required for SubjectContextFetus.");
    }

    var subjectIdItem = new TextContentItem({
      name: new CodedConcept({
        value: "121030",
        meaning: "Subject ID",
        schemeDesignator: "DCM"
      }),
      value: options.subjectID,
      relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
    });

    _this17.push(subjectIdItem);

    return _this17;
  }

  return _createClass(SubjectContextFetus);
}(Template);

var SubjectContextSpecimen = /*#__PURE__*/function (_Template11) {
  _inherits(SubjectContextSpecimen, _Template11);

  var _super12 = _createSuper(SubjectContextSpecimen);

  function SubjectContextSpecimen(options) {
    var _this18;

    _classCallCheck(this, SubjectContextSpecimen);

    _this18 = _super12.call(this);

    if (options.uid === undefined) {
      throw new Error("Option 'uid' is required for SubjectContextSpecimen.");
    }

    var specimenUidItem = new UIDRefContentItem({
      name: new CodedConcept({
        value: "121039",
        meaning: "Specimen UID",
        schemeDesignator: "DCM"
      }),
      value: options.uid,
      relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
    });

    _this18.push(specimenUidItem);

    if (options.identifier !== undefined) {
      var specimenIdentifierItem = new TextContentItem({
        name: new CodedConcept({
          value: "121041",
          meaning: "Specimen Identifier",
          schemeDesignator: "DCM"
        }),
        value: options.identifier,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this18.push(specimenIdentifierItem);
    }

    if (options.containerIdentifier !== undefined) {
      var containerIdentifierItem = new TextContentItem({
        name: new CodedConcept({
          value: "111700",
          meaning: "Specimen Container Identifier",
          schemeDesignator: "DCM"
        }),
        value: options.containerIdentifier,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this18.push(containerIdentifierItem);
    }

    if (options.specimenType !== undefined) {
      var specimenTypeItem = new CodeContentItem({
        name: new CodedConcept({
          value: "R-00254",
          meaning: "Specimen Type",
          schemeDesignator: "DCM"
        }),
        value: options.specimenType,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this18.push(specimenTypeItem);
    }

    return _this18;
  }

  return _createClass(SubjectContextSpecimen);
}(Template);

var SubjectContextDevice = /*#__PURE__*/function (_Template12) {
  _inherits(SubjectContextDevice, _Template12);

  _createSuper(SubjectContextDevice);

  function SubjectContextDevice(options) {
    var _this19;

    _classCallCheck(this, SubjectContextDevice);

    if (options.name === undefined) {
      throw new Error("Option 'name' is required for SubjectContextDevice.");
    }

    var deviceNameItem = new TextContentItem({
      name: new CodedConcept({
        value: "121193",
        meaning: "Device Subject Name",
        schemeDesignator: "DCM"
      }),
      value: options.name,
      relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
    });

    _this19.push(deviceNameItem);

    if (options.uid !== undefined) {
      var deviceUidItem = new UIDRefContentItem({
        name: new CodedConcept({
          value: "121198",
          meaning: "Device Subject UID",
          schemeDesignator: "DCM"
        }),
        value: options.uid,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this19.push(deviceUidItem);
    }

    if (options.manufacturerName !== undefined) {
      var manufacturerNameItem = new TextContentItem({
        name: new CodedConcept({
          value: "121194",
          meaning: "Device Subject Manufacturer",
          schemeDesignator: "DCM"
        }),
        value: options.manufacturerName,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this19.push(manufacturerNameItem);
    }

    if (options.modelName !== undefined) {
      var modelNameItem = new TextContentItem({
        name: new CodedConcept({
          value: "121195",
          meaning: "Device Subject Model Name",
          schemeDesignator: "DCM"
        }),
        value: options.modelName,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this19.push(modelNameItem);
    }

    if (options.serialNumber !== undefined) {
      var serialNumberItem = new TextContentItem({
        name: new CodedConcept({
          value: "121196",
          meaning: "Device Subject Serial Number",
          schemeDesignator: "DCM"
        }),
        value: options.serialNumber,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this19.push(serialNumberItem);
    }

    if (options.physicalLocation !== undefined) {
      var physicalLocationItem = new TextContentItem({
        name: new CodedConcept({
          value: "121197",
          meaning: "Device Subject Physical Location During Observation",
          schemeDesignator: "DCM"
        }),
        value: options.physicalLocation,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this19.push(physicalLocationItem);
    }

    return _possibleConstructorReturn(_this19);
  }

  return _createClass(SubjectContextDevice);
}(Template);

var LanguageOfContentItemAndDescendants = /*#__PURE__*/function (_Template13) {
  _inherits(LanguageOfContentItemAndDescendants, _Template13);

  var _super14 = _createSuper(LanguageOfContentItemAndDescendants);

  function LanguageOfContentItemAndDescendants(options) {
    var _this20;

    _classCallCheck(this, LanguageOfContentItemAndDescendants);

    _this20 = _super14.call(this);

    if (options.language === undefined) {
      options.language = new CodedConcept({
        value: "en-US",
        schemeDesignator: "RFC5646",
        meaning: "English (United States)"
      });
    }

    var languageItem = new CodeContentItem({
      name: new CodedConcept({
        value: "121049",
        meaning: "Language of Content Item and Descendants",
        schemeDesignator: "DCM"
      }),
      value: options.language,
      relationshipType: RelationshipTypes.HAS_CONCEPT_MOD
    });

    _this20.push(languageItem);

    return _this20;
  }

  return _createClass(LanguageOfContentItemAndDescendants);
}(Template);

var _MeasurementsAndQualitatitiveEvaluations = /*#__PURE__*/function (_Template14) {
  _inherits(_MeasurementsAndQualitatitiveEvaluations, _Template14);

  var _super15 = _createSuper(_MeasurementsAndQualitatitiveEvaluations);

  function _MeasurementsAndQualitatitiveEvaluations(options) {
    var _groupItem$ContentSeq;

    var _this21;

    _classCallCheck(this, _MeasurementsAndQualitatitiveEvaluations);

    _this21 = _super15.call(this);
    var groupItem = new ContainerContentItem({
      name: new CodedConcept({
        value: "125007",
        meaning: "Measurement Group",
        schemeDesignator: "DCM"
      }),
      relationshipType: RelationshipTypes.CONTAINS
    });
    groupItem.ContentSequence = new ContentSequence$1();

    if (options.trackingIdentifier === undefined) {
      throw new Error("Option 'trackingIdentifier' is required for measurements group.");
    }

    if (options.trackingIdentifier.constructor !== TrackingIdentifier) {
      throw new Error("Option 'trackingIdentifier' must have type TrackingIdentifier.");
    }

    if (options.trackingIdentifier.length !== 2) {
      throw new Error("Option 'trackingIdentifier' must include a human readable tracking " + "identifier and a tracking unique identifier.");
    }

    (_groupItem$ContentSeq = groupItem.ContentSequence).push.apply(_groupItem$ContentSeq, _toConsumableArray(options.trackingIdentifier));

    if (options.session !== undefined) {
      var sessionItem = new TextContentItem({
        name: new CodedConcept({
          value: "C67447",
          meaning: "Activity Session",
          schemeDesignator: "NCIt"
        }),
        value: options.session,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });
      groupItem.ContentSequence.push(sessionItem);
    }

    if (options.findingType !== undefined) {
      var findingTypeItem = new CodeContentItem({
        name: new CodedConcept({
          value: "121071",
          meaning: "Finding",
          schemeDesignator: "DCM"
        }),
        value: options.findingType,
        relationshipType: RelationshipTypes.CONTAINS
      });
      groupItem.ContentSequence.push(findingTypeItem);
    }

    if (options.timePointContext !== undefined) {
      var _groupItem$ContentSeq2;

      if (options.timePointContext.constructor !== TimePointContext) {
        throw new Error("Option 'timePointContext' must have type TimePointContext.");
      }

      (_groupItem$ContentSeq2 = groupItem.ContentSequence).push.apply(_groupItem$ContentSeq2, _toConsumableArray(timePointContext));
    }

    if (options.referencedRealWorldValueMap !== undefined) {
      if (options.referencedRealWorldValueMap.constructor !== ReferencedRealWorldValueMap) {
        throw new Error("Option 'referencedRealWorldValleMap' must have type " + "ReferencedRealWorldValueMap.");
      }

      groupItem.ContentSequence.push(options.referencedRealWorldValueMap);
    }

    if (options.measurements !== undefined) {
      if (!(_typeof(options.measurements) === "object" || options.measurements instanceof Array)) {
        throw new Error("Option 'measurements' must have type Array.");
      }

      options.measurements.forEach(function (measurement) {
        console.log(measurement);

        if (!measurement || measurement.constructor !== NumContentItem) {
          throw new Error("Items of option 'measurement' must have type NumContentItem.");
        }

        groupItem.ContentSequence.push(measurement);
      });
    }

    if (options.qualitativeEvaluations !== undefined) {
      if (!(_typeof(options.qualitativeEvaluations) === "object" || options.qualitativeEvaluations instanceof Array)) {
        throw new Error("Option 'qualitativeEvaluations' must have type Array.");
      }

      options.qualitativeEvaluations.forEach(function (evaluation) {
        if (!evaluation || evaluation.constructor !== CodeContentItem && evaluation.constructor !== TextContentItem) {
          throw new Error("Items of option 'qualitativeEvaluations' must have type " + "CodeContentItem or TextContentItem.");
        }

        groupItem.ContentSequence.push(evaluation);
      });
    }

    _this21.push(groupItem);

    return _this21;
  }

  return _createClass(_MeasurementsAndQualitatitiveEvaluations);
}(Template);

var _ROIMeasurementsAndQualitativeEvaluations = /*#__PURE__*/function (_MeasurementsAndQuali) {
  _inherits(_ROIMeasurementsAndQualitativeEvaluations, _MeasurementsAndQuali);

  var _super16 = _createSuper(_ROIMeasurementsAndQualitativeEvaluations);

  function _ROIMeasurementsAndQualitativeEvaluations(options) {
    var _this22;

    _classCallCheck(this, _ROIMeasurementsAndQualitativeEvaluations);

    _this22 = _super16.call(this, {
      trackingIdentifier: options.trackingIdentifier,
      timePointContext: options.timePointContext,
      findingType: options.findingType,
      session: options.session,
      measurements: options.measurements,
      qualitativeEvaluations: options.qualitativeEvaluations
    });
    var groupItem = _this22[0];
    var wereReferencesProvided = [options.referencedRegions !== undefined, options.referencedVolume !== undefined, options.referencedSegmentation !== undefined];
    var numReferences = wereReferencesProvided.reduce(function (a, b) {
      return a + b;
    });

    if (numReferences === 0) {
      throw new Error("One of the following options must be provided: " + "'referencedRegions', 'referencedVolume', or " + "'referencedSegmentation'.");
    } else if (numReferences > 1) {
      throw new Error("Only one of the following options should be provided: " + "'referencedRegions', 'referencedVolume', or " + "'referencedSegmentation'.");
    }

    if (options.referencedRegions !== undefined) {
      if (!(_typeof(options.referencedRegions) === "object" || options.referencedRegions instanceof Array)) {
        throw new Error("Option 'referencedRegions' must have type Array.");
      }

      if (options.referencedRegions.length === 0) {
        throw new Error("Option 'referencedRegion' must have non-zero length.");
      }

      options.referencedRegions.forEach(function (region) {
        if (region === undefined || region.constructor !== ImageRegion && region.constructor !== ImageRegion3D) {
          throw new Error("Items of option 'referencedRegion' must have type " + "ImageRegion or ImageRegion3D.");
        }

        groupItem.ContentSequence.push(region);
      });
    } else if (options.referencedVolume !== undefined) {
      if (options.referencedVolume.constructor !== VolumeSurface) {
        throw new Error("Items of option 'referencedVolume' must have type VolumeSurface.");
      }

      groupItem.ContentSequence.push(referencedVolume);
    } else if (options.referencedSegmentation !== undefined) {
      if (options.referencedSegmentation.constructor !== ReferencedSegmentation && options.referencedSegmentation.constructor !== ReferencedSegmentationFrame) {
        throw new Error("Option 'referencedSegmentation' must have type " + "ReferencedSegmentation or ReferencedSegmentationFrame.");
      }

      groupItem.ContentSequence.push(referencedSegmentation);
    }

    _this22[0] = groupItem;
    return _this22;
  }

  return _createClass(_ROIMeasurementsAndQualitativeEvaluations);
}(_MeasurementsAndQualitatitiveEvaluations);

var PlanarROIMeasurementsAndQualitativeEvaluations = /*#__PURE__*/function (_ROIMeasurementsAndQu) {
  _inherits(PlanarROIMeasurementsAndQualitativeEvaluations, _ROIMeasurementsAndQu);

  var _super17 = _createSuper(PlanarROIMeasurementsAndQualitativeEvaluations);

  function PlanarROIMeasurementsAndQualitativeEvaluations(options) {
    _classCallCheck(this, PlanarROIMeasurementsAndQualitativeEvaluations);

    var wereReferencesProvided = [options.referencedRegion !== undefined, options.referencedSegmentation !== undefined];
    var numReferences = wereReferencesProvided.reduce(function (a, b) {
      return a + b;
    });

    if (numReferences === 0) {
      throw new Error("One of the following options must be provided: " + "'referencedRegion', 'referencedSegmentation'.");
    } else if (numReferences > 1) {
      throw new Error("Only one of the following options should be provided: " + "'referencedRegion', 'referencedSegmentation'.");
    }

    return _super17.call(this, {
      trackingIdentifier: options.trackingIdentifier,
      referencedRegions: [options.referencedRegion],
      referencedSegmentation: options.referencedSegmentation,
      referencedRealWorldValueMap: options.referencedRealWorldValueMap,
      timePointContext: options.timePointContext,
      findingType: options.findingType,
      session: options.session,
      measurements: options.measurements,
      qualitativeEvaluations: options.qualitativeEvaluations
    });
  }

  return _createClass(PlanarROIMeasurementsAndQualitativeEvaluations);
}(_ROIMeasurementsAndQualitativeEvaluations);

var VolumetricROIMeasurementsAndQualitativeEvaluations = /*#__PURE__*/function (_ROIMeasurementsAndQu2) {
  _inherits(VolumetricROIMeasurementsAndQualitativeEvaluations, _ROIMeasurementsAndQu2);

  var _super18 = _createSuper(VolumetricROIMeasurementsAndQualitativeEvaluations);

  function VolumetricROIMeasurementsAndQualitativeEvaluations(options) {
    _classCallCheck(this, VolumetricROIMeasurementsAndQualitativeEvaluations);

    return _super18.call(this, {
      trackingIdentifier: options.trackingIdentifier,
      referencedRegions: options.referencedRegions,
      referencedSegmentation: options.referencedSegmentation,
      referencedRealWorldValueMap: options.referencedRealWorldValueMap,
      timePointContext: options.timePointContext,
      findingType: options.findingType,
      session: options.session,
      measurements: options.measurements,
      qualitativeEvaluations: options.qualitativeEvaluations
    });
  }

  return _createClass(VolumetricROIMeasurementsAndQualitativeEvaluations);
}(_ROIMeasurementsAndQualitativeEvaluations);

var MeasurementsDerivedFromMultipleROIMeasurements = /*#__PURE__*/function (_Template15) {
  _inherits(MeasurementsDerivedFromMultipleROIMeasurements, _Template15);

  _createSuper(MeasurementsDerivedFromMultipleROIMeasurements);

  function MeasurementsDerivedFromMultipleROIMeasurements(options) {
    var _this23;

    _classCallCheck(this, MeasurementsDerivedFromMultipleROIMeasurements);

    if (options.derivation === undefined) {
      throw new Error("Option 'derivation' is required for " + "MeasurementsDerivedFromMultipleROIMeasurements.");
    } // FIXME


    var valueItem = new NumContentItem({
      name: options.derivation
    });
    valueItem.ContentSequence = new ContentSequence$1();

    if (options.measurementGroups === undefined) {
      throw new Error("Option 'measurementGroups' is required for " + "MeasurementsDerivedFromMultipleROIMeasurements.");
    }

    if (!(_typeof(options.measurementGroups) === "object" || options.measurementGroups instanceof Array)) {
      throw new Error("Option 'measurementGroups' must have type Array.");
    }

    options.measurementGroups.forEach(function (group) {
      var _valueItem$ContentSeq4;

      if (!group || group.constructor !== PlanarROIMeasurementsAndQualitativeEvaluations && group.constructor !== VolumetricROIMeasurementsAndQualitativeEvaluations) {
        throw new Error("Items of option 'measurementGroups' must have type " + "PlanarROIMeasurementsAndQualitativeEvaluations or " + "VolumetricROIMeasurementsAndQualitativeEvaluations.");
      }

      group[0].RelationshipType = "R-INFERRED FROM";

      (_valueItem$ContentSeq4 = valueItem.ContentSequence).push.apply(_valueItem$ContentSeq4, _toConsumableArray(group));
    });

    if (options.measurementProperties !== undefined) {
      var _valueItem$ContentSeq5;

      if (options.measurementProperties.constructor !== MeasurementProperties) {
        throw new Error("Option 'measurementProperties' must have type MeasurementProperties.");
      }

      (_valueItem$ContentSeq5 = valueItem.ContentSequence).push.apply(_valueItem$ContentSeq5, _toConsumableArray(options.measurementProperties));
    }

    _this23.push(valueItem);

    return _possibleConstructorReturn(_this23);
  }

  return _createClass(MeasurementsDerivedFromMultipleROIMeasurements);
}(Template);

var MeasurementAndQualitativeEvaluationGroup = /*#__PURE__*/function (_MeasurementsAndQuali2) {
  _inherits(MeasurementAndQualitativeEvaluationGroup, _MeasurementsAndQuali2);

  var _super20 = _createSuper(MeasurementAndQualitativeEvaluationGroup);

  function MeasurementAndQualitativeEvaluationGroup(options) {
    _classCallCheck(this, MeasurementAndQualitativeEvaluationGroup);

    return _super20.call(this, {
      trackingIdentifier: options.trackingIdentifier,
      referencedRealWorldValueMap: options.referencedRealWorldValueMap,
      timePointContext: options.timePointContext,
      findingType: options.findingType,
      session: options.session,
      measurements: options.measurements,
      qualitativeEvaluations: options.qualitativeEvaluations
    });
  }

  return _createClass(MeasurementAndQualitativeEvaluationGroup);
}(_MeasurementsAndQualitatitiveEvaluations);

var ROIMeasurements = /*#__PURE__*/function (_Template16) {
  _inherits(ROIMeasurements, _Template16);

  var _super21 = _createSuper(ROIMeasurements);

  function ROIMeasurements(options) {
    var _this24;

    _classCallCheck(this, ROIMeasurements);

    _this24 = _super21.call(this);

    if (options.method !== undefined) {
      var methodItem = new CodeContentItem({
        name: new CodedConcept({
          value: "370129005",
          meaning: "Measurement Method",
          schemeDesignator: "SCT"
        }),
        value: options.method,
        relationshipType: RelationshipTypes.HAS_CONCEPT_MOD
      });

      _this24.push(methodItem);
    }

    if (options.findingSites !== undefined) {
      if (!(_typeof(options.findingSites) === "object" || options.findingSites instanceof Array)) {
        throw new Error("Option 'findingSites' must have type Array.");
      }

      options.findingSites.forEach(function (site) {
        if (!site || site.constructor !== FindingSite) {
          throw new Error("Items of option 'findingSites' must have type FindingSite.");
        }

        _this24.push(site);
      });
    }

    if (options.measurements === undefined) {
      throw new Error("Options 'measurements' is required ROIMeasurements.");
    }

    if (!(_typeof(options.measurements) === "object" || options.measurements instanceof Array)) {
      throw new Error("Option 'measurements' must have type Array.");
    }

    if (options.measurements.length === 0) {
      throw new Error("Option 'measurements' must have non-zero length.");
    }

    options.measurements.forEach(function (measurement) {
      if (!measurement || measurement.constructor !== Measurement) {
        throw new Error("Items of option 'measurements' must have type Measurement.");
      }

      _this24.push(measurement);
    });
    return _this24;
  }

  return _createClass(ROIMeasurements);
}(Template);

var MeasurementReport = /*#__PURE__*/function (_Template17) {
  _inherits(MeasurementReport, _Template17);

  var _super22 = _createSuper(MeasurementReport);

  function MeasurementReport(options) {
    var _item$ContentSequence, _item$ContentSequence2, _item$ContentSequence3;

    var _this25;

    _classCallCheck(this, MeasurementReport);

    _this25 = _super22.call(this);

    if (options.observationContext === undefined) {
      throw new Error("Option 'observationContext' is required for MeasurementReport.");
    }

    if (options.procedureReported === undefined) {
      throw new Error("Option 'procedureReported' is required for MeasurementReport.");
    }

    var item = new ContainerContentItem({
      name: new CodedConcept({
        value: "126000",
        schemeDesignator: "DCM",
        meaning: "Imaging Measurement Report"
      }),
      templateID: "1500"
    });
    item.ContentSequence = new ContentSequence$1();

    if (options.languageOfContentItemAndDescendants === undefined) {
      throw new Error("Option 'languageOfContentItemAndDescendants' is required for " + "MeasurementReport.");
    }

    if (options.languageOfContentItemAndDescendants.constructor !== LanguageOfContentItemAndDescendants) {
      throw new Error("Option 'languageOfContentItemAndDescendants' must have type " + "LanguageOfContentItemAndDescendants.");
    }

    (_item$ContentSequence = item.ContentSequence).push.apply(_item$ContentSequence, _toConsumableArray(options.languageOfContentItemAndDescendants));

    (_item$ContentSequence2 = item.ContentSequence).push.apply(_item$ContentSequence2, _toConsumableArray(options.observationContext));

    if (options.procedureReported.constructor === CodedConcept || options.procedureReported.constructor === Code) {
      options.procedureReported = [options.procedureReported];
    }

    if (!(_typeof(options.procedureReported) === "object" || options.procedureReported instanceof Array)) {
      throw new Error("Option 'procedureReported' must have type Array.");
    }

    options.procedureReported.forEach(function (procedure) {
      var procedureItem = new CodeContentItem({
        name: new CodedConcept({
          value: "121058",
          meaning: "Procedure reported",
          schemeDesignator: "DCM"
        }),
        value: procedure,
        relationshipType: RelationshipTypes.HAS_CONCEPT_MOD
      });
      item.ContentSequence.push(procedureItem);
    });
    var imageLibraryItem = new ImageLibrary();

    (_item$ContentSequence3 = item.ContentSequence).push.apply(_item$ContentSequence3, _toConsumableArray(imageLibraryItem));

    var wereOptionsProvided = [options.imagingMeasurements !== undefined, options.derivedImagingMeasurements !== undefined, options.qualitativeEvaluations !== undefined];
    var numOptionsProvided = wereOptionsProvided.reduce(function (a, b) {
      return a + b;
    });

    if (numOptionsProvided > 1) {
      throw new Error("Only one of the following options should be provided: " + "'imagingMeasurements', 'derivedImagingMeasurement', " + "'qualitativeEvaluations'.");
    }

    if (options.imagingMeasurements !== undefined) {
      var containerItem = new ContainerContentItem({
        name: new CodedConcept({
          value: "126010",
          meaning: "Imaging Measurements",
          schemeDesignator: "DCM"
        }),
        relationshipType: RelationshipTypes.CONTAINS
      });
      containerItem.ContentSequence = _construct(ContentSequence$1, _toConsumableArray(options.imagingMeasurements));
      item.ContentSequence.push(containerItem);
    } else if (options.derivedImagingMeasurements !== undefined) {
      var _containerItem = new ContainerContentItem({
        name: new CodedConcept({
          value: "126011",
          meaning: "Derived Imaging Measurements",
          schemeDesignator: "DCM"
        }),
        relationshipType: RelationshipTypes.CONTAINS
      });

      _containerItem.ContentSequence = _construct(ContentSequence$1, _toConsumableArray(options.derivedImagingMeasurements));
      item.ContentSequence.push(_containerItem);
    } else if (options.qualitativeEvaluations !== undefined) {
      var _containerItem2 = new ContainerContentItem({
        name: new CodedConcept({
          value: "C0034375",
          meaning: "Qualitative Evaluations",
          schemeDesignator: "UMLS"
        }),
        relationshipType: RelationshipTypes.CONTAINS
      });

      _containerItem2.ContentSequence = _construct(ContentSequence$1, _toConsumableArray(options.qualitativeEvaluations));
      item.ContentSequence.push(_containerItem2);
    }

    _this25.push(item);

    return _this25;
  }

  return _createClass(MeasurementReport);
}(Template);

var TimePointContext = /*#__PURE__*/function (_Template18) {
  _inherits(TimePointContext, _Template18);

  _createSuper(TimePointContext);

  function TimePointContext(options) {
    var _this26;

    _classCallCheck(this, TimePointContext);

    if (options.timePoint === undefined) {
      throw new Error("Option 'timePoint' is required for TimePointContext.");
    }

    var timePointItem = new TextContentItem({
      name: new CodedConcept({
        value: "C2348792",
        meaning: "Time Point",
        schemeDesignator: "UMLS"
      }),
      value: options.timePoint,
      relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
    });

    _this26.push(timePointItem);

    if (options.timePointType !== undefined) {
      var timePointTypeItem = new CodeContentItem({
        name: new CodedConcept({
          value: "126072",
          meaning: "Time Point Type",
          schemeDesignator: "DCM"
        }),
        value: options.timePointType,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this26.push(timePointTypeItem);
    }

    if (options.timePointOrder !== undefined) {
      var timePointOrderItem = new NumContentItem({
        name: new CodedConcept({
          value: "126073",
          meaning: "Time Point Order",
          schemeDesignator: "DCM"
        }),
        value: options.timePointOrder,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this26.push(timePointOrderItem);
    }

    if (options.subjectTimePointIdentifier !== undefined) {
      var subjectTimePointIdentifierItem = new NumContentItem({
        name: new CodedConcept({
          value: "126070",
          meaning: "Subject Time Point Identifier",
          schemeDesignator: "DCM"
        }),
        value: options.subjectTimePointIdentifier,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this26.push(subjectTimePointIdentifierItem);
    }

    if (options.protocolTimePointIdentifier !== undefined) {
      var protocolTimePointIdentifierItem = new NumContentItem({
        name: new CodedConcept({
          value: "126071",
          meaning: "Protocol Time Point Identifier",
          schemeDesignator: "DCM"
        }),
        value: options.protocolTimePointIdentifier,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this26.push(protocolTimePointIdentifierItem);
    }

    if (options.temporalOffsetFromEvent !== undefined) {
      if (options.temporalOffsetFromEvent.constructor !== LongitudinalTemporalOffsetFromEventContentItem) {
        throw new Error("Option 'temporalOffsetFromEvent' must have type " + "LongitudinalTemporalOffsetFromEventContentItem.");
      }

      _this26.push(temporalOffsetFromEvent);
    }

    return _possibleConstructorReturn(_this26);
  }

  return _createClass(TimePointContext);
}(Template);

var ImageLibrary = /*#__PURE__*/function (_Template19) {
  _inherits(ImageLibrary, _Template19);

  var _super24 = _createSuper(ImageLibrary);

  function ImageLibrary(options) {
    var _this27;

    _classCallCheck(this, ImageLibrary);

    _this27 = _super24.call(this);
    var libraryItem = new ContainerContentItem({
      name: new CodedConcept({
        value: "111028",
        meaning: "Image Library",
        schemeDesignator: "DCM"
      }),
      relationshipType: RelationshipTypes.CONTAINS
    });

    _this27.push(libraryItem);

    return _this27;
  }

  return _createClass(ImageLibrary);
}(Template);

var AlgorithmIdentification = /*#__PURE__*/function (_Template20) {
  _inherits(AlgorithmIdentification, _Template20);

  var _super25 = _createSuper(AlgorithmIdentification);

  function AlgorithmIdentification(options) {
    var _this28;

    _classCallCheck(this, AlgorithmIdentification);

    _this28 = _super25.call(this);

    if (options.name === undefined) {
      throw new Error("Option 'name' is required for AlgorithmIdentification.");
    }

    if (options.version === undefined) {
      throw new Error("Option 'version' is required for AlgorithmIdentification.");
    }

    var nameItem = new TextContentItem({
      name: new CodedConcept({
        value: "111001",
        meaning: "Algorithm Name",
        schemeDesignator: "DCM"
      }),
      value: options.name,
      relationshipType: RelationshipTypes.HAS_CONCEPT_MOD
    });

    _this28.push(nameItem);

    var versionItem = new TextContentItem({
      name: new CodedConcept({
        value: "111003",
        meaning: "Algorithm Version",
        schemeDesignator: "DCM"
      }),
      value: options.version,
      relationshipType: RelationshipTypes.HAS_CONCEPT_MOD
    });

    _this28.push(versionItem);

    if (options.parameters !== undefined) {
      if (!(_typeof(options.parameters) === "object" || options.parameters instanceof Array)) {
        throw new Error("Option 'parameters' must have type Array.");
      }

      options.parameters.forEach(function (parameter) {
        var parameterItem = new TextContentItem({
          name: new CodedConcept({
            value: "111002",
            meaning: "Algorithm Parameter",
            schemeDesignator: "DCM"
          }),
          value: param,
          relationshipType: RelationshipTypes.HAS_CONCEPT_MOD
        });

        _this28.push(parameterItem);
      });
    }

    return _this28;
  }

  return _createClass(AlgorithmIdentification);
}(Template);

var TrackingIdentifier = /*#__PURE__*/function (_Template21) {
  _inherits(TrackingIdentifier, _Template21);

  var _super26 = _createSuper(TrackingIdentifier);

  function TrackingIdentifier(options) {
    var _this29;

    _classCallCheck(this, TrackingIdentifier);

    _this29 = _super26.call(this);

    if (options.uid === undefined) {
      throw new Error("Option 'uid' is required for TrackingIdentifier.");
    }

    if (options.identifier !== undefined) {
      var trackingIdentifierItem = new TextContentItem({
        name: new CodedConcept({
          value: "112039",
          meaning: "Tracking Identifier",
          schemeDesignator: "DCM"
        }),
        value: options.identifier,
        relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
      });

      _this29.push(trackingIdentifierItem);
    }

    var trackingUIDItem = new UIDRefContentItem({
      name: new CodedConcept({
        value: "112040",
        meaning: "Tracking Unique Identifier",
        schemeDesignator: "DCM"
      }),
      value: options.uid,
      relationshipType: RelationshipTypes.HAS_OBS_CONTEXT
    });

    _this29.push(trackingUIDItem);

    return _this29;
  }

  return _createClass(TrackingIdentifier);
}(Template);

var templates = /*#__PURE__*/Object.freeze({
	__proto__: null,
	AlgorithmIdentification: AlgorithmIdentification,
	DeviceObserverIdentifyingAttributes: DeviceObserverIdentifyingAttributes,
	ImageLibrary: ImageLibrary,
	LanguageOfContentItemAndDescendants: LanguageOfContentItemAndDescendants,
	Measurement: Measurement,
	MeasurementAndQualitativeEvaluationGroup: MeasurementAndQualitativeEvaluationGroup,
	MeasurementReport: MeasurementReport,
	MeasurementsDerivedFromMultipleROIMeasurements: MeasurementsDerivedFromMultipleROIMeasurements,
	ObservationContext: ObservationContext,
	ObserverContext: ObserverContext,
	PersonObserverIdentifyingAttributes: PersonObserverIdentifyingAttributes,
	PlanarROIMeasurementsAndQualitativeEvaluations: PlanarROIMeasurementsAndQualitativeEvaluations,
	ROIMeasurements: ROIMeasurements,
	SubjectContext: SubjectContext,
	SubjectContextDevice: SubjectContextDevice,
	SubjectContextFetus: SubjectContextFetus,
	SubjectContextSpecimen: SubjectContextSpecimen,
	TimePointContext: TimePointContext,
	TrackingIdentifier: TrackingIdentifier,
	VolumetricROIMeasurementsAndQualitativeEvaluations: VolumetricROIMeasurementsAndQualitativeEvaluations
});

var _attributesToInclude = [// Patient
"00080054", "00080100", "00080102", "00080103", "00080104", "00080105", "00080106", "00080107", "0008010B", "0008010D", "0008010F", "00080117", "00080118", "00080119", "00080120", "00080121", "00080122", "00081120", "00081150", "00081155", "00081160", "00081190", "00081199", "00100010", "00100020", "00100021", "00100022", "00100024", "00100026", "00100027", "00100028", "00100030", "00100032", "00100033", "00100034", "00100035", "00100040", "00100200", "00100212", "00100213", "00100214", "00100215", "00100216", "00100217", "00100218", "00100219", "00100221", "00100222", "00100223", "00100229", "00101001", "00101002", "00101100", "00102160", "00102201", "00102202", "00102292", "00102293", "00102294", "00102295", "00102296", "00102297", "00102298", "00102299", "00104000", "00120062", "00120063", "00120064", "0020000D", "00400031", "00400032", "00400033", "00400035", "00400036", "00400039", "0040003A", "0040E001", "0040E010", "0040E020", "0040E021", "0040E022", "0040E023", "0040E024", "0040E025", "0040E030", "0040E031", "0062000B", "00880130", "00880140", // Patient Study
"00080100", "00080102", "00080103", "00080104", "00080105", "00080106", "00080107", "0008010B", "0008010D", "0008010F", "00080117", "00080118", "00080119", "00080120", "00080121", "00080122", "00081080", "00081084", "00101010", "00101020", "00101021", "00101022", "00101023", "00101024", "00101030", "00102000", "00102110", "00102180", "001021A0", "001021B0", "001021C0", "001021D0", "00102203", "00380010", "00380014", "00380060", "00380062", "00380064", "00380500", "00400031", "00400032", "00400033", // General Study
"00080020", "00080030", "00080050", "00080051", "00080080", "00080081", "00080082", "00080090", "00080096", "0008009C", "0008009D", "00080100", "00080102", "00080103", "00080104", "00080105", "00080106", "00080107", "0008010B", "0008010D", "0008010F", "00080117", "00080118", "00080119", "00080120", "00080121", "00080122", "00081030", "00081032", "00081048", "00081049", "00081060", "00081062", "00081110", "00081150", "00081155", "0020000D", "00200010", "00321034", "00400031", "00400032", "00400033", "00401012", "00401101", "00401102", "00401103", "00401104", // Clinical Trial Subject
"00120010", "00120020", "00120021", "00120030", "00120031", "00120040", "00120042", "00120081", "00120082", // Clinical Trial Study
"00120020", "00120050", "00120051", "00120052", "00120053", "00120083", "00120084", "00120085"];

var Comprehensive3DSR = /*#__PURE__*/_createClass(function Comprehensive3DSR(options) {
  var _this = this;

  _classCallCheck(this, Comprehensive3DSR);

  if (options.evidence === undefined) {
    throw new Error("Option 'evidence' is required for Comprehensive3DSR.");
  }

  if (!(_typeof(options.evidence) === "object" || options.evidence instanceof Array)) {
    throw new Error("Option 'evidence' must have type Array.");
  }

  if (options.evidence.length === 0) {
    throw new Error("Option 'evidence' must have non-zero length.");
  }

  if (options.content === undefined) {
    throw new Error("Option 'content' is required for Comprehensive3DSR.");
  }

  if (options.seriesInstanceUID === undefined) {
    throw new Error("Option 'seriesInstanceUID' is required for Comprehensive3DSR.");
  }

  if (options.seriesNumber === undefined) {
    throw new Error("Option 'seriesNumber' is required for Comprehensive3DSR.");
  }

  if (options.seriesDescription === undefined) {
    throw new Error("Option 'seriesDescription' is required for Comprehensive3DSR.");
  }

  if (options.sopInstanceUID === undefined) {
    throw new Error("Option 'sopInstanceUID' is required for Comprehensive3DSR.");
  }

  if (options.instanceNumber === undefined) {
    throw new Error("Option 'instanceNumber' is required for Comprehensive3DSR.");
  }

  if (options.manufacturer === undefined) {
    throw new Error("Option 'manufacturer' is required for Comprehensive3DSR.");
  }

  this.SOPClassUID = "1.2.840.10008.5.1.4.1.1.88.34";
  this.SOPInstanceUID = options.sopInstanceUID;
  this.Modality = "SR";
  this.SeriesDescription = options.seriesDescription;
  this.SeriesInstanceUID = options.seriesInstanceUID;
  this.SeriesNumber = options.seriesNumber;
  this.InstanceNumber = options.instanceNumber;
  this.Manufacturer = options.manufacturer;

  if (options.institutionName !== undefined) {
    this.InstitutionName = options.institutionName;

    if (options.institutionalDepartmentName !== undefined) {
      this.InstitutionalDepartmentName = options.institutionDepartmentName;
    }
  }

  if (options.isComplete) {
    this.CompletionFlag = "COMPLETE";
  } else {
    this.CompletionFlag = "PARTIAL";
  }

  if (options.isVerified) {
    if (options.verifyingObserverName === undefined) {
      throw new Error("Verifying Observer Name must be specified if SR document " + "has been verified.");
    }

    if (options.verifyingOrganization === undefined) {
      throw new Error("Verifying Organization must be specified if SR document " + "has been verified.");
    }

    this.VerificationFlag = "VERIFIED";
    var ovserver_item = {};
    ovserver_item.VerifyingObserverName = options.verifyingObserverName;
    ovserver_item.VerifyingOrganization = options.verifyingOrganization;
    ovserver_item.VerificationDateTime = DicomMetaDictionary.dateTime();
    this.VerifyingObserverSequence = [observer_item];
  } else {
    this.VerificationFlag = "UNVERIFIED";
  }

  if (options.isFinal) {
    this.PreliminaryFlag = "FINAL";
  } else {
    this.PreliminaryFlag = "PRELIMINARY";
  }

  this.ContentDate = DicomMetaDictionary.date();
  this.ContentTime = DicomMetaDictionary.time();
  Object.keys(options.content).forEach(function (keyword) {
    _this[keyword] = options.content[keyword];
  });
  var evidenceCollection = {};
  options.evidence.forEach(function (evidence) {
    if (evidence.StudyInstanceUID !== options.evidence[0].StudyInstanceUID) {
      throw new Error("Referenced data sets must all belong to the same study.");
    }

    if (!(evidence.SeriesInstanceUID in evidenceCollection)) {
      evidenceCollection[evidence.SeriesInstanceUID] = [];
    }

    var instanceItem = {};
    instanceItem.ReferencedSOPClassUID = evidence.SOPClassUID;
    instanceItem.ReferencedSOPInstanceUID = evidence.SOPInstanceUID;
    evidenceCollection[evidence.SeriesInstanceUID].push(instanceItem);
  });
  var evidenceStudyItem = {};
  evidenceStudyItem.StudyInstanceUID = options.evidence[0].StudyInstanceUID;
  evidenceStudyItem.ReferencedSeriesSequence = [];
  Object.keys(evidenceCollection).forEach(function (seriesInstanceUID) {
    var seriesItem = {};
    seriesItem.SeriesInstanceUID = seriesInstanceUID;
    seriesItem.ReferencedSOPSequence = evidenceCollection[seriesInstanceUID];
    evidenceStudyItem.ReferencedSeriesSequence.push(seriesItem);
  });

  if (options.requestedProcedures !== undefined) {
    if (!(_typeof(options.requestedProcedures) === "object" || options.requestedProcedures instanceof Array)) {
      throw new Error("Option 'requestedProcedures' must have type Array.");
    }

    this.ReferencedRequestSequence = _construct(ContentSequence, _toConsumableArray(options.requestedProcedures));
    this.CurrentRequestedProcedureEvidenceSequence = [evidenceStudyItem];
  } else {
    this.PertinentOtherEvidenceSequence = [evidenceStudyItem];
  }

  if (options.previousVersions !== undefined) {
    var preCollection = {};
    options.previousVersions.forEach(function (version) {
      if (version.StudyInstanceUID != options.evidence[0].StudyInstanceUID) {
        throw new Error("Previous version data sets must belong to the same study.");
      }

      var instanceItem = {};
      instanceItem.ReferencedSOPClassUID = version.SOPClassUID;
      instanceItem.ReferencedSOPInstanceUID = version.SOPInstanceUID;
      preCollection[version.SeriesInstanceUID].push(instanceItem);
    });
    var preStudyItem = {};
    preStudyItem.StudyInstanceUID = options.previousVersions[0].StudyInstanceUID;
    preStudyItem.ReferencedSeriesSequence = [];
    Object.keys(preCollection).forEach(function (seriesInstanceUID) {
      var seriesItem = {};
      seriesItem.SeriesInstanceUID = seriesInstanceUID;
      seriesItem.ReferencedSOPSequence = preCollection[seriesInstanceUID];
      preStudyItem.ReferencedSeriesSequence.push(seriesItem);
    });
    this.PredecessorDocumentsSequence = [preStudyItem];
  }

  if (options.performedProcedureCodes !== undefined) {
    if (!(_typeof(options.performedProcedureCodes) === "object" || options.performedProcedureCodes instanceof Array)) {
      throw new Error("Option 'performedProcedureCodes' must have type Array.");
    }

    this.PerformedProcedureCodeSequence = _construct(ContentSequence, _toConsumableArray(options.performedProcedureCodes));
  } else {
    this.PerformedProcedureCodeSequence = [];
  }

  this.ReferencedPerformedProcedureStepSequence = [];

  _attributesToInclude.forEach(function (tag) {
    var key = DicomMetaDictionary.punctuateTag(tag);
    var element = DicomMetaDictionary.dictionary[key];

    if (element !== undefined) {
      var keyword = element.name;
      var value = options.evidence[0][keyword];

      if (value !== undefined) {
        _this[keyword] = value;
      }
    }
  });
});

var documents = /*#__PURE__*/Object.freeze({
	__proto__: null,
	Comprehensive3DSR: Comprehensive3DSR
});

var sr = {
  coding: coding,
  contentItems: contentItems,
  documents: documents,
  templates: templates,
  valueTypes: valueTypes
};

var tagNamesToEmpty = [// please override these in specificReplaceDefaults to have useful values
"PatientID", "PatientName", // 0/3: those that appear missing in CTP
"SeriesDate", "AccessionNumber", // (valuable, but sometimes manually filled)
"SeriesDescription", // cat 1/3: CTP: set to empty explicitely using @empty
"StudyTime", "ContentTime", "ReferringPhysicianName", "PatientBirthDate", "PatientSex", "ClinicalTrialSiteID", "ClinicalTrialSiteName", "ClinicalTrialSubjectID", "ClinicalTrialSubjectReadingID", "ClinicalTrialTimePointID", "ClinicalTrialTimePointDescription", "ContrastBolusAgent", "StudyID", // cat 2/3: CTP: set to increment dates
"InstanceCreationDate", "StudyDate", "ContentDate", "DateOfSecondaryCapture", "DateOfLastCalibration", "DateOfLastDetectorCalibration", "FrameAcquisitionDatetime", "FrameReferenceDatetime", "StudyVerifiedDate", "StudyReadDate", "ScheduledStudyStartDate", "ScheduledStudyStopDate", "StudyArrivalDate", "StudyCompletionDate", "ScheduledAdmissionDate", "ScheduledDischargeDate", "DischargeDate", "SPSStartDate", "SPSEndDate", "PPSStartDate", "PPSEndDate", "IssueDateOfImagingServiceRequest", "VerificationDateTime", "ObservationDateTime", "DateTime", "Date", "RefDatetime", // cat 3/3: CTP: set to remove using @remove
"AcquisitionDate", "OverlayDate", "CurveDate", "AcquisitionDatetime", "SeriesTime", "AcquisitionTime", "OverlayTime", "CurveTime", "InstitutionName", "InstitutionAddress", "ReferringPhysicianAddress", "ReferringPhysicianPhoneNumbers", "ReferringPhysiciansIDSeq", "TimezoneOffsetFromUTC", "StationName", "StudyDescription", "InstitutionalDepartmentName", "PhysicianOfRecord", "PhysicianOfRecordIdSeq", "PerformingPhysicianName", "PerformingPhysicianIdSeq", "NameOfPhysicianReadingStudy", "PhysicianReadingStudyIdSeq", "OperatorName", "OperatorsIdentificationSeq", "AdmittingDiagnosisDescription", "AdmittingDiagnosisCodeSeq", "RefStudySeq", "RefPPSSeq", "RefPatientSeq", "RefImageSeq", "DerivationDescription", "SourceImageSeq", "IdentifyingComments", "IssuerOfPatientID", "PatientBirthTime", "PatientInsurancePlanCodeSeq", "PatientPrimaryLanguageCodeSeq", "PatientPrimaryLanguageModifierCodeSeq", "OtherPatientIDs", "OtherPatientNames", "OtherPatientIDsSeq", "PatientBirthName", "PatientAge", "PatientSize", "PatientWeight", "PatientAddress", "InsurancePlanIdentification", "PatientMotherBirthName", "MilitaryRank", "BranchOfService", "MedicalRecordLocator", "MedicalAlerts", "ContrastAllergies", "CountryOfResidence", "RegionOfResidence", "PatientPhoneNumbers", "EthnicGroup", "Occupation", "SmokingStatus", "AdditionalPatientHistory", "PregnancyStatus", "LastMenstrualDate", "PatientReligiousPreference", "PatientSexNeutered", "ResponsiblePerson", "ResponsibleOrganization", "PatientComments", "DeviceSerialNumber", "PlateID", "GeneratorID", "CassetteID", "GantryID", // we keep - should be SoftwareVersions anyway
// "SoftwareVersion",
"ProtocolName", "AcquisitionDeviceProcessingDescription", "AcquisitionComments", "DetectorID", "AcquisitionProtocolDescription", "ContributionDescription", "ModifyingDeviceID", "ModifyingDeviceManufacturer", "ModifiedImageDescription", "ImageComments", "ImagePresentationComments", "StudyIDIssuer", "ScheduledStudyLocation", "ScheduledStudyLocationAET", "ReasonforStudy", "RequestingPhysician", "RequestingService", "RequestedProcedureDescription", "RequestedContrastAgent", "StudyComments", "AdmissionID", "IssuerOfAdmissionID", "ScheduledPatientInstitutionResidence", "AdmittingDate", "AdmittingTime", "DischargeDiagnosisDescription", "SpecialNeeds", "ServiceEpisodeID", "IssuerOfServiceEpisodeId", "ServiceEpisodeDescription", "CurrentPatientLocation", "PatientInstitutionResidence", "PatientState", "ReferencedPatientAliasSeq", "VisitComments", "ScheduledStationAET", "ScheduledPerformingPhysicianName", "SPSDescription", "ScheduledStationName", "SPSLocation", "PreMedication", "PerformedStationAET", "PerformedStationName", "PerformedLocation", "PerformedStationNameCodeSeq", "PPSID", "PPSDescription", "RequestAttributesSeq", "PPSComments", "AcquisitionContextSeq", "PatientTransportArrangements", "RequestedProcedureLocation", "NamesOfIntendedRecipientsOfResults", "IntendedRecipientsOfResultsIDSequence", "PersonAddress", "PersonTelephoneNumbers", "RequestedProcedureComments", "ReasonForTheImagingServiceRequest", "OrderEnteredBy", "OrderEntererLocation", "OrderCallbackPhoneNumber", "ImagingServiceRequestComments", "ConfidentialityPatientData", "ScheduledStationNameCodeSeq", "ScheduledStationGeographicLocCodeSeq", "PerformedStationGeoLocCodeSeq", "ScheduledHumanPerformersSeq", "ActualHumanPerformersSequence", "HumanPerformersOrganization", "HumanPerformersName", "VerifyingOrganization", "VerifyingObserverName", "AuthorObserverSequence", "ParticipantSequence", "CustodialOrganizationSeq", "VerifyingObserverIdentificationCodeSeq", "PersonName", "ContentSeq", "OverlayData", "OverlayComments", "IconImageSequence", "TopicSubject", "TopicAuthor", "TopicKeyWords", "TextString", "Arbitrary", "TextComments", "ResultsIDIssuer", "InterpretationRecorder", "InterpretationTranscriber", "InterpretationText", "InterpretationAuthor", "InterpretationApproverSequence", "PhysicianApprovingInterpretation", "InterpretationDiagnosisDescription", "ResultsDistributionListSeq", "DistributionName", "DistributionAddress", "InterpretationIdIssuer", "Impressions", "ResultComments", "DigitalSignaturesSeq", "DataSetTrailingPadding"];
function getTagsNameToEmpty() {
  return [].concat(tagNamesToEmpty);
}
function cleanTags(dict) {
  var tagNamesToReplace = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;
  var customTagNamesToEmpty = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : undefined;

  if (tagNamesToReplace == undefined) {
    tagNamesToReplace = {
      "00100010": "ANON^PATIENT",
      "00100020": "ANON^ID"
    };
  }

  var tags = customTagNamesToEmpty != undefined ? customTagNamesToEmpty : tagNamesToEmpty;
  tags.forEach(function (tag) {
    var tagInfo = DicomMetaDictionary.nameMap[tag];

    if (tagInfo && tagInfo.version != "PrivateTag") {
      var tagNumber = tagInfo.tag,
          tagString = Tag.fromPString(tagNumber).toCleanString();

      if (dict[tagString]) {
        var newValue;

        if (tagString in tagNamesToReplace) {
          newValue = [tagNamesToReplace[tagString]];
        } else {
          newValue = [];
        }

        dict[tagString].Value = newValue;
      }
    }
  });
}

// Data
var data = {
  BitArray: BitArray,
  ReadBufferStream: ReadBufferStream,
  DeflatedReadBufferStream: DeflatedReadBufferStream,
  WriteBufferStream: WriteBufferStream,
  DicomDict: DicomDict,
  DicomMessage: DicomMessage,
  DicomMetaDictionary: DicomMetaDictionary,
  Tag: Tag,
  ValueRepresentation: ValueRepresentation,
  Colors: Colors,
  datasetToDict: datasetToDict,
  datasetToBuffer: datasetToBuffer,
  datasetToBlob: datasetToBlob
};
var derivations = {
  DerivedDataset: DerivedDataset,
  DerivedPixels: DerivedPixels,
  DerivedImage: DerivedImage,
  Segmentation: Segmentation$4,
  StructuredReport: StructuredReport,
  ParametricMap: ParametricMap
};
var normalizers = {
  Normalizer: Normalizer,
  ImageNormalizer: ImageNormalizer,
  MRImageNormalizer: MRImageNormalizer,
  EnhancedMRImageNormalizer: EnhancedMRImageNormalizer,
  EnhancedUSVolumeNormalizer: EnhancedUSVolumeNormalizer,
  CTImageNormalizer: CTImageNormalizer,
  PETImageNormalizer: PETImageNormalizer,
  SEGImageNormalizer: SEGImageNormalizer,
  DSRNormalizer: DSRNormalizer
};
var anonymizer = {
  cleanTags: cleanTags,
  getTagsNameToEmpty: getTagsNameToEmpty
};
var dcmjs = {
  DICOMWEB: DICOMWEB,
  adapters: adapters,
  data: data,
  derivations: derivations,
  normalizers: normalizers,
  sr: sr,
  utilities: utilities,
  log: log,
  anonymizer: anonymizer
};

export { DICOMWEB, adapters, anonymizer, data, dcmjs as default, derivations, log, normalizers, sr, utilities };
//# sourceMappingURL=dcmjs.es.js.map