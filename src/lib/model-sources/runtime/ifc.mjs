/* eslint-disable -- Generated from tools/bim-viewer by scripts/sync-model-source-runtime.mjs. */

// src/import/ifc.ts
import {
  IfcAPI,
  IFCPRODUCT,
  IFCPROJECT,
  IFCBUILDINGSTOREY,
  IFCRELDEFINESBYPROPERTIES,
  IFCRELDEFINESBYTYPE,
  IFCRELCONTAINEDINSPATIALSTRUCTURE,
  IFCRELAGGREGATES,
  IFCRELNESTS,
  IFCRELASSOCIATESCLASSIFICATION,
  REF
} from "web-ifc";

// node_modules/three/src/constants.js
var NeverDepth = 0;
var AlwaysDepth = 1;
var LessDepth = 2;
var LessEqualDepth = 3;
var EqualDepth = 4;
var GreaterEqualDepth = 5;
var GreaterDepth = 6;
var NotEqualDepth = 7;
var WebGLCoordinateSystem = 2e3;
var WebGPUCoordinateSystem = 2001;

// node_modules/three/src/utils.js
var _setConsoleFunction = null;
function enhanceLogMessage(params) {
  const message = params[0];
  if (typeof message === "string" && message.startsWith("TSL:")) {
    const stackTrace = params[1];
    if (stackTrace && stackTrace.isStackTrace) {
      params[0] += " " + stackTrace.getLocation();
    } else {
      params[1] = 'Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.';
    }
  }
  return params;
}
function warn(...params) {
  params = enhanceLogMessage(params);
  const message = "THREE." + params.shift();
  if (_setConsoleFunction) {
    _setConsoleFunction("warn", message, ...params);
  } else {
    const stackTrace = params[0];
    if (stackTrace && stackTrace.isStackTrace) {
      console.warn(stackTrace.getError(message));
    } else {
      console.warn(message, ...params);
    }
  }
}
var ReversedDepthFuncs = {
  [NeverDepth]: AlwaysDepth,
  [LessDepth]: GreaterDepth,
  [EqualDepth]: NotEqualDepth,
  [LessEqualDepth]: GreaterEqualDepth,
  [AlwaysDepth]: NeverDepth,
  [GreaterDepth]: LessDepth,
  [NotEqualDepth]: EqualDepth,
  [GreaterEqualDepth]: LessEqualDepth
};

// node_modules/three/src/math/MathUtils.js
var DEG2RAD = Math.PI / 180;
var RAD2DEG = 180 / Math.PI;
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// node_modules/three/src/math/Quaternion.js
var Quaternion = class {
  /**
   * Constructs a new quaternion.
   *
   * @param {number} [x=0] - The x value of this quaternion.
   * @param {number} [y=0] - The y value of this quaternion.
   * @param {number} [z=0] - The z value of this quaternion.
   * @param {number} [w=1] - The w value of this quaternion.
   */
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.isQuaternion = true;
    this._x = x;
    this._y = y;
    this._z = z;
    this._w = w;
  }
  /**
   * Interpolates between two quaternions via SLERP. This implementation assumes the
   * quaternion data are managed in flat arrays.
   *
   * @param {Array<number>} dst - The destination array.
   * @param {number} dstOffset - An offset into the destination array.
   * @param {Array<number>} src0 - The source array of the first quaternion.
   * @param {number} srcOffset0 - An offset into the first source array.
   * @param {Array<number>} src1 -  The source array of the second quaternion.
   * @param {number} srcOffset1 - An offset into the second source array.
   * @param {number} t - The interpolation factor. A value in the range `[0,1]` will interpolate. A value outside the range `[0,1]` will extrapolate.
   * @see {@link Quaternion#slerp}
   */
  static slerpFlat(dst, dstOffset, src0, srcOffset0, src1, srcOffset1, t) {
    let x0 = src0[srcOffset0 + 0], y0 = src0[srcOffset0 + 1], z0 = src0[srcOffset0 + 2], w0 = src0[srcOffset0 + 3];
    let x1 = src1[srcOffset1 + 0], y1 = src1[srcOffset1 + 1], z1 = src1[srcOffset1 + 2], w1 = src1[srcOffset1 + 3];
    if (w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1) {
      let dot = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1;
      if (dot < 0) {
        x1 = -x1;
        y1 = -y1;
        z1 = -z1;
        w1 = -w1;
        dot = -dot;
      }
      let s = 1 - t;
      if (dot < 0.9995) {
        const theta = Math.acos(dot);
        const sin = Math.sin(theta);
        s = Math.sin(s * theta) / sin;
        t = Math.sin(t * theta) / sin;
        x0 = x0 * s + x1 * t;
        y0 = y0 * s + y1 * t;
        z0 = z0 * s + z1 * t;
        w0 = w0 * s + w1 * t;
      } else {
        x0 = x0 * s + x1 * t;
        y0 = y0 * s + y1 * t;
        z0 = z0 * s + z1 * t;
        w0 = w0 * s + w1 * t;
        const f = 1 / Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0);
        x0 *= f;
        y0 *= f;
        z0 *= f;
        w0 *= f;
      }
    }
    dst[dstOffset] = x0;
    dst[dstOffset + 1] = y0;
    dst[dstOffset + 2] = z0;
    dst[dstOffset + 3] = w0;
  }
  /**
   * Multiplies two quaternions. This implementation assumes the quaternion data are managed
   * in flat arrays.
   *
   * @param {Array<number>} dst - The destination array.
   * @param {number} dstOffset - An offset into the destination array.
   * @param {Array<number>} src0 - The source array of the first quaternion.
   * @param {number} srcOffset0 - An offset into the first source array.
   * @param {Array<number>} src1 -  The source array of the second quaternion.
   * @param {number} srcOffset1 - An offset into the second source array.
   * @return {Array<number>} The destination array.
   * @see {@link Quaternion#multiplyQuaternions}.
   */
  static multiplyQuaternionsFlat(dst, dstOffset, src0, srcOffset0, src1, srcOffset1) {
    const x0 = src0[srcOffset0];
    const y0 = src0[srcOffset0 + 1];
    const z0 = src0[srcOffset0 + 2];
    const w0 = src0[srcOffset0 + 3];
    const x1 = src1[srcOffset1];
    const y1 = src1[srcOffset1 + 1];
    const z1 = src1[srcOffset1 + 2];
    const w1 = src1[srcOffset1 + 3];
    dst[dstOffset] = x0 * w1 + w0 * x1 + y0 * z1 - z0 * y1;
    dst[dstOffset + 1] = y0 * w1 + w0 * y1 + z0 * x1 - x0 * z1;
    dst[dstOffset + 2] = z0 * w1 + w0 * z1 + x0 * y1 - y0 * x1;
    dst[dstOffset + 3] = w0 * w1 - x0 * x1 - y0 * y1 - z0 * z1;
    return dst;
  }
  /**
   * The x value of this quaternion.
   *
   * @type {number}
   * @default 0
   */
  get x() {
    return this._x;
  }
  set x(value) {
    this._x = value;
    this._onChangeCallback();
  }
  /**
   * The y value of this quaternion.
   *
   * @type {number}
   * @default 0
   */
  get y() {
    return this._y;
  }
  set y(value) {
    this._y = value;
    this._onChangeCallback();
  }
  /**
   * The z value of this quaternion.
   *
   * @type {number}
   * @default 0
   */
  get z() {
    return this._z;
  }
  set z(value) {
    this._z = value;
    this._onChangeCallback();
  }
  /**
   * The w value of this quaternion.
   *
   * @type {number}
   * @default 1
   */
  get w() {
    return this._w;
  }
  set w(value) {
    this._w = value;
    this._onChangeCallback();
  }
  /**
   * Sets the quaternion components.
   *
   * @param {number} x - The x value of this quaternion.
   * @param {number} y - The y value of this quaternion.
   * @param {number} z - The z value of this quaternion.
   * @param {number} w - The w value of this quaternion.
   * @return {Quaternion} A reference to this quaternion.
   */
  set(x, y, z, w) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._w = w;
    this._onChangeCallback();
    return this;
  }
  /**
   * Returns a new quaternion with copied values from this instance.
   *
   * @return {Quaternion} A clone of this instance.
   */
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._w);
  }
  /**
   * Copies the values of the given quaternion to this instance.
   *
   * @param {Quaternion} quaternion - The quaternion to copy.
   * @return {Quaternion} A reference to this quaternion.
   */
  copy(quaternion) {
    this._x = quaternion.x;
    this._y = quaternion.y;
    this._z = quaternion.z;
    this._w = quaternion.w;
    this._onChangeCallback();
    return this;
  }
  /**
   * Sets this quaternion from the rotation specified by the given
   * Euler angles.
   *
   * @param {Euler} euler - The Euler angles.
   * @param {boolean} [update=true] - Whether the internal `onChange` callback should be executed or not.
   * @return {Quaternion} A reference to this quaternion.
   */
  setFromEuler(euler, update = true) {
    const x = euler._x, y = euler._y, z = euler._z, order = euler._order;
    const cos = Math.cos;
    const sin = Math.sin;
    const c1 = cos(x / 2);
    const c2 = cos(y / 2);
    const c3 = cos(z / 2);
    const s1 = sin(x / 2);
    const s2 = sin(y / 2);
    const s3 = sin(z / 2);
    switch (order) {
      case "XYZ":
        this._x = s1 * c2 * c3 + c1 * s2 * s3;
        this._y = c1 * s2 * c3 - s1 * c2 * s3;
        this._z = c1 * c2 * s3 + s1 * s2 * c3;
        this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "YXZ":
        this._x = s1 * c2 * c3 + c1 * s2 * s3;
        this._y = c1 * s2 * c3 - s1 * c2 * s3;
        this._z = c1 * c2 * s3 - s1 * s2 * c3;
        this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case "ZXY":
        this._x = s1 * c2 * c3 - c1 * s2 * s3;
        this._y = c1 * s2 * c3 + s1 * c2 * s3;
        this._z = c1 * c2 * s3 + s1 * s2 * c3;
        this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "ZYX":
        this._x = s1 * c2 * c3 - c1 * s2 * s3;
        this._y = c1 * s2 * c3 + s1 * c2 * s3;
        this._z = c1 * c2 * s3 - s1 * s2 * c3;
        this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case "YZX":
        this._x = s1 * c2 * c3 + c1 * s2 * s3;
        this._y = c1 * s2 * c3 + s1 * c2 * s3;
        this._z = c1 * c2 * s3 - s1 * s2 * c3;
        this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "XZY":
        this._x = s1 * c2 * c3 - c1 * s2 * s3;
        this._y = c1 * s2 * c3 - s1 * c2 * s3;
        this._z = c1 * c2 * s3 + s1 * s2 * c3;
        this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      default:
        warn("Quaternion: .setFromEuler() encountered an unknown order: " + order);
    }
    if (update === true) this._onChangeCallback();
    return this;
  }
  /**
   * Sets this quaternion from the given axis and angle.
   *
   * @param {Vector3} axis - The normalized axis.
   * @param {number} angle - The angle in radians.
   * @return {Quaternion} A reference to this quaternion.
   */
  setFromAxisAngle(axis, angle) {
    const halfAngle = angle / 2, s = Math.sin(halfAngle);
    this._x = axis.x * s;
    this._y = axis.y * s;
    this._z = axis.z * s;
    this._w = Math.cos(halfAngle);
    this._onChangeCallback();
    return this;
  }
  /**
   * Sets this quaternion from the given rotation matrix.
   *
   * @param {Matrix4} m - A 4x4 matrix of which the upper 3x3 of matrix is a pure rotation matrix (i.e. unscaled).
   * @return {Quaternion} A reference to this quaternion.
   */
  setFromRotationMatrix(m) {
    const te = m.elements, m11 = te[0], m12 = te[4], m13 = te[8], m21 = te[1], m22 = te[5], m23 = te[9], m31 = te[2], m32 = te[6], m33 = te[10], trace = m11 + m22 + m33;
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1);
      this._w = 0.25 / s;
      this._x = (m32 - m23) * s;
      this._y = (m13 - m31) * s;
      this._z = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
      this._w = (m32 - m23) / s;
      this._x = 0.25 * s;
      this._y = (m12 + m21) / s;
      this._z = (m13 + m31) / s;
    } else if (m22 > m33) {
      const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
      this._w = (m13 - m31) / s;
      this._x = (m12 + m21) / s;
      this._y = 0.25 * s;
      this._z = (m23 + m32) / s;
    } else {
      const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
      this._w = (m21 - m12) / s;
      this._x = (m13 + m31) / s;
      this._y = (m23 + m32) / s;
      this._z = 0.25 * s;
    }
    this._onChangeCallback();
    return this;
  }
  /**
   * Sets this quaternion to the rotation required to rotate the direction vector
   * `vFrom` to the direction vector `vTo`.
   *
   * @param {Vector3} vFrom - The first (normalized) direction vector.
   * @param {Vector3} vTo - The second (normalized) direction vector.
   * @return {Quaternion} A reference to this quaternion.
   */
  setFromUnitVectors(vFrom, vTo) {
    let r = vFrom.dot(vTo) + 1;
    if (r < 1e-8) {
      r = 0;
      if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) {
        this._x = -vFrom.y;
        this._y = vFrom.x;
        this._z = 0;
        this._w = r;
      } else {
        this._x = 0;
        this._y = -vFrom.z;
        this._z = vFrom.y;
        this._w = r;
      }
    } else {
      this._x = vFrom.y * vTo.z - vFrom.z * vTo.y;
      this._y = vFrom.z * vTo.x - vFrom.x * vTo.z;
      this._z = vFrom.x * vTo.y - vFrom.y * vTo.x;
      this._w = r;
    }
    return this.normalize();
  }
  /**
   * Returns the angle between this quaternion and the given one in radians.
   *
   * @param {Quaternion} q - The quaternion to compute the angle with.
   * @return {number} The angle in radians.
   */
  angleTo(q) {
    return 2 * Math.acos(Math.abs(clamp(this.dot(q), -1, 1)));
  }
  /**
   * Rotates this quaternion by a given angular step to the given quaternion.
   * The method ensures that the final quaternion will not overshoot `q`.
   *
   * @param {Quaternion} q - The target quaternion.
   * @param {number} step - The angular step in radians.
   * @return {Quaternion} A reference to this quaternion.
   */
  rotateTowards(q, step) {
    const angle = this.angleTo(q);
    if (angle === 0) return this;
    const t = Math.min(1, step / angle);
    this.slerp(q, t);
    return this;
  }
  /**
   * Sets this quaternion to the identity quaternion; that is, to the
   * quaternion that represents "no rotation".
   *
   * @return {Quaternion} A reference to this quaternion.
   */
  identity() {
    return this.set(0, 0, 0, 1);
  }
  /**
   * Inverts this quaternion via {@link Quaternion#conjugate}. The
   * quaternion is assumed to have unit length.
   *
   * @return {Quaternion} A reference to this quaternion.
   */
  invert() {
    return this.conjugate();
  }
  /**
   * Returns the rotational conjugate of this quaternion. The conjugate of a
   * quaternion represents the same rotation in the opposite direction about
   * the rotational axis.
   *
   * @return {Quaternion} A reference to this quaternion.
   */
  conjugate() {
    this._x *= -1;
    this._y *= -1;
    this._z *= -1;
    this._onChangeCallback();
    return this;
  }
  /**
   * Calculates the dot product of this quaternion and the given one.
   *
   * @param {Quaternion} v - The quaternion to compute the dot product with.
   * @return {number} The result of the dot product.
   */
  dot(v) {
    return this._x * v._x + this._y * v._y + this._z * v._z + this._w * v._w;
  }
  /**
   * Computes the squared Euclidean length (straight-line length) of this quaternion,
   * considered as a 4 dimensional vector. This can be useful if you are comparing the
   * lengths of two quaternions, as this is a slightly more efficient calculation than
   * {@link Quaternion#length}.
   *
   * @return {number} The squared Euclidean length.
   */
  lengthSq() {
    return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;
  }
  /**
   * Computes the Euclidean length (straight-line length) of this quaternion,
   * considered as a 4 dimensional vector.
   *
   * @return {number} The Euclidean length.
   */
  length() {
    return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w);
  }
  /**
   * Normalizes this quaternion - that is, calculated the quaternion that performs
   * the same rotation as this one, but has a length equal to `1`.
   *
   * @return {Quaternion} A reference to this quaternion.
   */
  normalize() {
    let l = this.length();
    if (l === 0) {
      this._x = 0;
      this._y = 0;
      this._z = 0;
      this._w = 1;
    } else {
      l = 1 / l;
      this._x = this._x * l;
      this._y = this._y * l;
      this._z = this._z * l;
      this._w = this._w * l;
    }
    this._onChangeCallback();
    return this;
  }
  /**
   * Multiplies this quaternion by the given one.
   *
   * @param {Quaternion} q - The quaternion.
   * @return {Quaternion} A reference to this quaternion.
   */
  multiply(q) {
    return this.multiplyQuaternions(this, q);
  }
  /**
   * Pre-multiplies this quaternion by the given one.
   *
   * @param {Quaternion} q - The quaternion.
   * @return {Quaternion} A reference to this quaternion.
   */
  premultiply(q) {
    return this.multiplyQuaternions(q, this);
  }
  /**
   * Multiplies the given quaternions and stores the result in this instance.
   *
   * @param {Quaternion} a - The first quaternion.
   * @param {Quaternion} b - The second quaternion.
   * @return {Quaternion} A reference to this quaternion.
   */
  multiplyQuaternions(a, b) {
    const qax = a._x, qay = a._y, qaz = a._z, qaw = a._w;
    const qbx = b._x, qby = b._y, qbz = b._z, qbw = b._w;
    this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
    this._onChangeCallback();
    return this;
  }
  /**
   * Performs a spherical linear interpolation between this quaternion and the target quaternion.
   *
   * @param {Quaternion} qb - The target quaternion.
   * @param {number} t - The interpolation factor. A value in the range `[0,1]` will interpolate. A value outside the range `[0,1]` will extrapolate.
   * @return {Quaternion} A reference to this quaternion.
   */
  slerp(qb, t) {
    let x = qb._x, y = qb._y, z = qb._z, w = qb._w;
    let dot = this.dot(qb);
    if (dot < 0) {
      x = -x;
      y = -y;
      z = -z;
      w = -w;
      dot = -dot;
    }
    let s = 1 - t;
    if (dot < 0.9995) {
      const theta = Math.acos(dot);
      const sin = Math.sin(theta);
      s = Math.sin(s * theta) / sin;
      t = Math.sin(t * theta) / sin;
      this._x = this._x * s + x * t;
      this._y = this._y * s + y * t;
      this._z = this._z * s + z * t;
      this._w = this._w * s + w * t;
      this._onChangeCallback();
    } else {
      this._x = this._x * s + x * t;
      this._y = this._y * s + y * t;
      this._z = this._z * s + z * t;
      this._w = this._w * s + w * t;
      this.normalize();
    }
    return this;
  }
  /**
   * Performs a spherical linear interpolation between the given quaternions
   * and stores the result in this quaternion.
   *
   * @param {Quaternion} qa - The source quaternion.
   * @param {Quaternion} qb - The target quaternion.
   * @param {number} t - The interpolation factor in the closed interval `[0, 1]`.
   * @return {Quaternion} A reference to this quaternion.
   */
  slerpQuaternions(qa, qb, t) {
    return this.copy(qa).slerp(qb, t);
  }
  /**
   * Sets this quaternion to a uniformly random, normalized quaternion.
   *
   * @return {Quaternion} A reference to this quaternion.
   */
  random() {
    const theta1 = 2 * Math.PI * Math.random();
    const theta2 = 2 * Math.PI * Math.random();
    const x0 = Math.random();
    const r1 = Math.sqrt(1 - x0);
    const r2 = Math.sqrt(x0);
    return this.set(
      r1 * Math.sin(theta1),
      r1 * Math.cos(theta1),
      r2 * Math.sin(theta2),
      r2 * Math.cos(theta2)
    );
  }
  /**
   * Returns `true` if this quaternion is equal with the given one.
   *
   * @param {Quaternion} quaternion - The quaternion to test for equality.
   * @return {boolean} Whether this quaternion is equal with the given one.
   */
  equals(quaternion) {
    return quaternion._x === this._x && quaternion._y === this._y && quaternion._z === this._z && quaternion._w === this._w;
  }
  /**
   * Sets this quaternion's components from the given array.
   *
   * @param {Array<number>} array - An array holding the quaternion component values.
   * @param {number} [offset=0] - The offset into the array.
   * @return {Quaternion} A reference to this quaternion.
   */
  fromArray(array, offset = 0) {
    this._x = array[offset];
    this._y = array[offset + 1];
    this._z = array[offset + 2];
    this._w = array[offset + 3];
    this._onChangeCallback();
    return this;
  }
  /**
   * Writes the components of this quaternion to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param {Array<number>} [array=[]] - The target array holding the quaternion components.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Array<number>} The quaternion components.
   */
  toArray(array = [], offset = 0) {
    array[offset] = this._x;
    array[offset + 1] = this._y;
    array[offset + 2] = this._z;
    array[offset + 3] = this._w;
    return array;
  }
  /**
   * Sets the components of this quaternion from the given buffer attribute.
   *
   * @param {BufferAttribute} attribute - The buffer attribute holding quaternion data.
   * @param {number} index - The index into the attribute.
   * @return {Quaternion} A reference to this quaternion.
   */
  fromBufferAttribute(attribute, index) {
    this._x = attribute.getX(index);
    this._y = attribute.getY(index);
    this._z = attribute.getZ(index);
    this._w = attribute.getW(index);
    this._onChangeCallback();
    return this;
  }
  /**
   * This methods defines the serialization result of this class. Returns the
   * numerical elements of this quaternion in an array of format `[x, y, z, w]`.
   *
   * @return {Array<number>} The serialized quaternion.
   */
  toJSON() {
    return this.toArray();
  }
  _onChange(callback) {
    this._onChangeCallback = callback;
    return this;
  }
  _onChangeCallback() {
  }
  *[Symbol.iterator]() {
    yield this._x;
    yield this._y;
    yield this._z;
    yield this._w;
  }
};

// node_modules/three/src/math/Vector3.js
var Vector3 = class _Vector3 {
  static {
    _Vector3.prototype.isVector3 = true;
  }
  /**
   * Constructs a new 3D vector.
   *
   * @param {number} [x=0] - The x value of this vector.
   * @param {number} [y=0] - The y value of this vector.
   * @param {number} [z=0] - The z value of this vector.
   */
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  /**
   * Sets the vector components.
   *
   * @param {number} x - The value of the x component.
   * @param {number} y - The value of the y component.
   * @param {number} z - The value of the z component.
   * @return {Vector3} A reference to this vector.
   */
  set(x, y, z) {
    if (z === void 0) z = this.z;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  /**
   * Sets the vector components to the same value.
   *
   * @param {number} scalar - The value to set for all vector components.
   * @return {Vector3} A reference to this vector.
   */
  setScalar(scalar) {
    this.x = scalar;
    this.y = scalar;
    this.z = scalar;
    return this;
  }
  /**
   * Sets the vector's x component to the given value.
   *
   * @param {number} x - The value to set.
   * @return {Vector3} A reference to this vector.
   */
  setX(x) {
    this.x = x;
    return this;
  }
  /**
   * Sets the vector's y component to the given value.
   *
   * @param {number} y - The value to set.
   * @return {Vector3} A reference to this vector.
   */
  setY(y) {
    this.y = y;
    return this;
  }
  /**
   * Sets the vector's z component to the given value.
   *
   * @param {number} z - The value to set.
   * @return {Vector3} A reference to this vector.
   */
  setZ(z) {
    this.z = z;
    return this;
  }
  /**
   * Allows to set a vector component with an index.
   *
   * @param {number} index - The component index. `0` equals to x, `1` equals to y, `2` equals to z.
   * @param {number} value - The value to set.
   * @return {Vector3} A reference to this vector.
   */
  setComponent(index, value) {
    switch (index) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      case 2:
        this.z = value;
        break;
      default:
        throw new Error("THREE.Vector3: index is out of range: " + index);
    }
    return this;
  }
  /**
   * Returns the value of the vector component which matches the given index.
   *
   * @param {number} index - The component index. `0` equals to x, `1` equals to y, `2` equals to z.
   * @return {number} A vector component value.
   */
  getComponent(index) {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      default:
        throw new Error("THREE.Vector3: index is out of range: " + index);
    }
  }
  /**
   * Returns a new vector with copied values from this instance.
   *
   * @return {Vector3} A clone of this instance.
   */
  clone() {
    return new this.constructor(this.x, this.y, this.z);
  }
  /**
   * Copies the values of the given vector to this instance.
   *
   * @param {Vector3} v - The vector to copy.
   * @return {Vector3} A reference to this vector.
   */
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  /**
   * Adds the given vector to this instance.
   *
   * @param {Vector3} v - The vector to add.
   * @return {Vector3} A reference to this vector.
   */
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  /**
   * Adds the given scalar value to all components of this instance.
   *
   * @param {number} s - The scalar to add.
   * @return {Vector3} A reference to this vector.
   */
  addScalar(s) {
    this.x += s;
    this.y += s;
    this.z += s;
    return this;
  }
  /**
   * Adds the given vectors and stores the result in this instance.
   *
   * @param {Vector3} a - The first vector.
   * @param {Vector3} b - The second vector.
   * @return {Vector3} A reference to this vector.
   */
  addVectors(a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    this.z = a.z + b.z;
    return this;
  }
  /**
   * Adds the given vector scaled by the given factor to this instance.
   *
   * @param {Vector3|Vector4} v - The vector.
   * @param {number} s - The factor that scales `v`.
   * @return {Vector3} A reference to this vector.
   */
  addScaledVector(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
  /**
   * Subtracts the given vector from this instance.
   *
   * @param {Vector3} v - The vector to subtract.
   * @return {Vector3} A reference to this vector.
   */
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  /**
   * Subtracts the given scalar value from all components of this instance.
   *
   * @param {number} s - The scalar to subtract.
   * @return {Vector3} A reference to this vector.
   */
  subScalar(s) {
    this.x -= s;
    this.y -= s;
    this.z -= s;
    return this;
  }
  /**
   * Subtracts the given vectors and stores the result in this instance.
   *
   * @param {Vector3} a - The first vector.
   * @param {Vector3} b - The second vector.
   * @return {Vector3} A reference to this vector.
   */
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }
  /**
   * Multiplies the given vector with this instance.
   *
   * @param {Vector3} v - The vector to multiply.
   * @return {Vector3} A reference to this vector.
   */
  multiply(v) {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    return this;
  }
  /**
   * Multiplies the given scalar value with all components of this instance.
   *
   * @param {number} scalar - The scalar to multiply.
   * @return {Vector3} A reference to this vector.
   */
  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }
  /**
   * Multiplies the given vectors and stores the result in this instance.
   *
   * @param {Vector3} a - The first vector.
   * @param {Vector3} b - The second vector.
   * @return {Vector3} A reference to this vector.
   */
  multiplyVectors(a, b) {
    this.x = a.x * b.x;
    this.y = a.y * b.y;
    this.z = a.z * b.z;
    return this;
  }
  /**
   * Applies the given Euler rotation to this vector.
   *
   * @param {Euler} euler - The Euler angles.
   * @return {Vector3} A reference to this vector.
   */
  applyEuler(euler) {
    return this.applyQuaternion(_quaternion.setFromEuler(euler));
  }
  /**
   * Applies a rotation specified by an axis and an angle to this vector.
   *
   * @param {Vector3} axis - A normalized vector representing the rotation axis.
   * @param {number} angle - The angle in radians.
   * @return {Vector3} A reference to this vector.
   */
  applyAxisAngle(axis, angle) {
    return this.applyQuaternion(_quaternion.setFromAxisAngle(axis, angle));
  }
  /**
   * Multiplies this vector with the given 3x3 matrix.
   *
   * @param {Matrix3} m - The 3x3 matrix.
   * @return {Vector3} A reference to this vector.
   */
  applyMatrix3(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    this.x = e[0] * x + e[3] * y + e[6] * z;
    this.y = e[1] * x + e[4] * y + e[7] * z;
    this.z = e[2] * x + e[5] * y + e[8] * z;
    return this;
  }
  /**
   * Multiplies this vector by the given normal matrix and normalizes
   * the result.
   *
   * @param {Matrix3} m - The normal matrix.
   * @return {Vector3} A reference to this vector.
   */
  applyNormalMatrix(m) {
    return this.applyMatrix3(m).normalize();
  }
  /**
   * Multiplies this vector (with an implicit 1 in the 4th dimension) by m, and
   * divides by perspective.
   *
   * @param {Matrix4} m - The matrix to apply.
   * @return {Vector3} A reference to this vector.
   */
  applyMatrix4(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
  /**
   * Applies the given Quaternion to this vector.
   *
   * @param {Quaternion} q - The Quaternion.
   * @return {Vector3} A reference to this vector.
   */
  applyQuaternion(q) {
    const vx = this.x, vy = this.y, vz = this.z;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    this.x = vx + qw * tx + qy * tz - qz * ty;
    this.y = vy + qw * ty + qz * tx - qx * tz;
    this.z = vz + qw * tz + qx * ty - qy * tx;
    return this;
  }
  /**
   * Projects this vector from world space into the camera's normalized
   * device coordinate (NDC) space.
   *
   * @param {Camera} camera - The camera.
   * @return {Vector3} A reference to this vector.
   */
  project(camera) {
    return this.applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  }
  /**
   * Unprojects this vector from the camera's normalized device coordinate (NDC)
   * space into world space.
   *
   * @param {Camera} camera - The camera.
   * @return {Vector3} A reference to this vector.
   */
  unproject(camera) {
    return this.applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
  }
  /**
   * Transforms this vector by the upper left 3x3 sub-matrix of the given 4x4 matrix,
   * and normalizes the result.
   *
   * @param {Matrix4} m - The matrix.
   * @return {Vector3} A reference to this vector.
   */
  transformDirection(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    this.x = e[0] * x + e[4] * y + e[8] * z;
    this.y = e[1] * x + e[5] * y + e[9] * z;
    this.z = e[2] * x + e[6] * y + e[10] * z;
    return this.normalize();
  }
  /**
   * Divides this instance by the given vector.
   *
   * @param {Vector3} v - The vector to divide.
   * @return {Vector3} A reference to this vector.
   */
  divide(v) {
    this.x /= v.x;
    this.y /= v.y;
    this.z /= v.z;
    return this;
  }
  /**
   * Divides this vector by the given scalar.
   *
   * @param {number} scalar - The scalar to divide.
   * @return {Vector3} A reference to this vector.
   */
  divideScalar(scalar) {
    return this.multiplyScalar(1 / scalar);
  }
  /**
   * If this vector's x, y or z value is greater than the given vector's x, y or z
   * value, replace that value with the corresponding min value.
   *
   * @param {Vector3} v - The vector.
   * @return {Vector3} A reference to this vector.
   */
  min(v) {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    this.z = Math.min(this.z, v.z);
    return this;
  }
  /**
   * If this vector's x, y or z value is less than the given vector's x, y or z
   * value, replace that value with the corresponding max value.
   *
   * @param {Vector3} v - The vector.
   * @return {Vector3} A reference to this vector.
   */
  max(v) {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    this.z = Math.max(this.z, v.z);
    return this;
  }
  /**
   * If this vector's x, y or z value is greater than the max vector's x, y or z
   * value, it is replaced by the corresponding value.
   * If this vector's x, y or z value is less than the min vector's x, y or z value,
   * it is replaced by the corresponding value.
   *
   * @param {Vector3} min - The minimum x, y and z values.
   * @param {Vector3} max - The maximum x, y and z values in the desired range.
   * @return {Vector3} A reference to this vector.
   */
  clamp(min, max) {
    this.x = clamp(this.x, min.x, max.x);
    this.y = clamp(this.y, min.y, max.y);
    this.z = clamp(this.z, min.z, max.z);
    return this;
  }
  /**
   * If this vector's x, y or z values are greater than the max value, they are
   * replaced by the max value.
   * If this vector's x, y or z values are less than the min value, they are
   * replaced by the min value.
   *
   * @param {number} minVal - The minimum value the components will be clamped to.
   * @param {number} maxVal - The maximum value the components will be clamped to.
   * @return {Vector3} A reference to this vector.
   */
  clampScalar(minVal, maxVal) {
    this.x = clamp(this.x, minVal, maxVal);
    this.y = clamp(this.y, minVal, maxVal);
    this.z = clamp(this.z, minVal, maxVal);
    return this;
  }
  /**
   * If this vector's length is greater than the max value, it is replaced by
   * the max value.
   * If this vector's length is less than the min value, it is replaced by the
   * min value.
   *
   * @param {number} min - The minimum value the vector length will be clamped to.
   * @param {number} max - The maximum value the vector length will be clamped to.
   * @return {Vector3} A reference to this vector.
   */
  clampLength(min, max) {
    const length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(clamp(length, min, max));
  }
  /**
   * The components of this vector are rounded down to the nearest integer value.
   *
   * @return {Vector3} A reference to this vector.
   */
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.z = Math.floor(this.z);
    return this;
  }
  /**
   * The components of this vector are rounded up to the nearest integer value.
   *
   * @return {Vector3} A reference to this vector.
   */
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    this.z = Math.ceil(this.z);
    return this;
  }
  /**
   * The components of this vector are rounded to the nearest integer value
   *
   * @return {Vector3} A reference to this vector.
   */
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    return this;
  }
  /**
   * The components of this vector are rounded towards zero (up if negative,
   * down if positive) to an integer value.
   *
   * @return {Vector3} A reference to this vector.
   */
  roundToZero() {
    this.x = Math.trunc(this.x);
    this.y = Math.trunc(this.y);
    this.z = Math.trunc(this.z);
    return this;
  }
  /**
   * Inverts this vector - i.e. sets x = -x, y = -y and z = -z.
   *
   * @return {Vector3} A reference to this vector.
   */
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }
  /**
   * Calculates the dot product of the given vector with this instance.
   *
   * @param {Vector3} v - The vector to compute the dot product with.
   * @return {number} The result of the dot product.
   */
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  /**
   * Computes the square of the Euclidean length (straight-line length) from
   * (0, 0, 0) to (x, y, z). If you are comparing the lengths of vectors, you should
   * compare the length squared instead as it is slightly more efficient to calculate.
   *
   * @return {number} The square length of this vector.
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  /**
   * Computes the  Euclidean length (straight-line length) from (0, 0, 0) to (x, y, z).
   *
   * @return {number} The length of this vector.
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  /**
   * Computes the Manhattan length of this vector.
   *
   * @return {number} The length of this vector.
   */
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
  }
  /**
   * Converts this vector to a unit vector - that is, sets it equal to a vector
   * with the same direction as this one, but with a vector length of `1`.
   *
   * @return {Vector3} A reference to this vector.
   */
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  /**
   * Sets this vector to a vector with the same direction as this one, but
   * with the specified length.
   *
   * @param {number} length - The new length of this vector.
   * @return {Vector3} A reference to this vector.
   */
  setLength(length) {
    return this.normalize().multiplyScalar(length);
  }
  /**
   * Linearly interpolates between the given vector and this instance, where
   * alpha is the percent distance along the line - alpha = 0 will be this
   * vector, and alpha = 1 will be the given one.
   *
   * @param {Vector3} v - The vector to interpolate towards.
   * @param {number} alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
   * @return {Vector3} A reference to this vector.
   */
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
  /**
   * Linearly interpolates between the given vectors, where alpha is the percent
   * distance along the line - alpha = 0 will be first vector, and alpha = 1 will
   * be the second one. The result is stored in this instance.
   *
   * @param {Vector3} v1 - The first vector.
   * @param {Vector3} v2 - The second vector.
   * @param {number} alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
   * @return {Vector3} A reference to this vector.
   */
  lerpVectors(v1, v2, alpha) {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    this.z = v1.z + (v2.z - v1.z) * alpha;
    return this;
  }
  /**
   * Calculates the cross product of the given vector with this instance.
   *
   * @param {Vector3} v - The vector to compute the cross product with.
   * @return {Vector3} The result of the cross product.
   */
  cross(v) {
    return this.crossVectors(this, v);
  }
  /**
   * Calculates the cross product of the given vectors and stores the result
   * in this instance.
   *
   * @param {Vector3} a - The first vector.
   * @param {Vector3} b - The second vector.
   * @return {Vector3} A reference to this vector.
   */
  crossVectors(a, b) {
    const ax = a.x, ay = a.y, az = a.z;
    const bx = b.x, by = b.y, bz = b.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }
  /**
   * Projects this vector onto the given one.
   *
   * @param {Vector3} v - The vector to project to.
   * @return {Vector3} A reference to this vector.
   */
  projectOnVector(v) {
    const denominator = v.lengthSq();
    if (denominator === 0) return this.set(0, 0, 0);
    const scalar = v.dot(this) / denominator;
    return this.copy(v).multiplyScalar(scalar);
  }
  /**
   * Projects this vector onto a plane by subtracting this
   * vector projected onto the plane's normal from this vector.
   *
   * @param {Vector3} planeNormal - The plane normal.
   * @return {Vector3} A reference to this vector.
   */
  projectOnPlane(planeNormal) {
    _vector.copy(this).projectOnVector(planeNormal);
    return this.sub(_vector);
  }
  /**
   * Reflects this vector off a plane orthogonal to the given normal vector.
   *
   * @param {Vector3} normal - The (normalized) normal vector.
   * @return {Vector3} A reference to this vector.
   */
  reflect(normal) {
    return this.sub(_vector.copy(normal).multiplyScalar(2 * this.dot(normal)));
  }
  /**
   * Returns the angle between the given vector and this instance in radians.
   *
   * @param {Vector3} v - The vector to compute the angle with.
   * @return {number} The angle in radians.
   */
  angleTo(v) {
    const denominator = Math.sqrt(this.lengthSq() * v.lengthSq());
    if (denominator === 0) return Math.PI / 2;
    const theta = this.dot(v) / denominator;
    return Math.acos(clamp(theta, -1, 1));
  }
  /**
   * Computes the distance from the given vector to this instance.
   *
   * @param {Vector3} v - The vector to compute the distance to.
   * @return {number} The distance.
   */
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  /**
   * Computes the squared distance from the given vector to this instance.
   * If you are just comparing the distance with another distance, you should compare
   * the distance squared instead as it is slightly more efficient to calculate.
   *
   * @param {Vector3} v - The vector to compute the squared distance to.
   * @return {number} The squared distance.
   */
  distanceToSquared(v) {
    const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }
  /**
   * Computes the Manhattan distance from the given vector to this instance.
   *
   * @param {Vector3} v - The vector to compute the Manhattan distance to.
   * @return {number} The Manhattan distance.
   */
  manhattanDistanceTo(v) {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y) + Math.abs(this.z - v.z);
  }
  /**
   * Sets the vector components from the given spherical coordinates.
   *
   * @param {Spherical} s - The spherical coordinates.
   * @return {Vector3} A reference to this vector.
   */
  setFromSpherical(s) {
    return this.setFromSphericalCoords(s.radius, s.phi, s.theta);
  }
  /**
   * Sets the vector components from the given spherical coordinates.
   *
   * @param {number} radius - The radius.
   * @param {number} phi - The phi angle in radians.
   * @param {number} theta - The theta angle in radians.
   * @return {Vector3} A reference to this vector.
   */
  setFromSphericalCoords(radius, phi, theta) {
    const sinPhiRadius = Math.sin(phi) * radius;
    this.x = sinPhiRadius * Math.sin(theta);
    this.y = Math.cos(phi) * radius;
    this.z = sinPhiRadius * Math.cos(theta);
    return this;
  }
  /**
   * Sets the vector components from the given cylindrical coordinates.
   *
   * @param {Cylindrical} c - The cylindrical coordinates.
   * @return {Vector3} A reference to this vector.
   */
  setFromCylindrical(c) {
    return this.setFromCylindricalCoords(c.radius, c.theta, c.y);
  }
  /**
   * Sets the vector components from the given cylindrical coordinates.
   *
   * @param {number} radius - The radius.
   * @param {number} theta - The theta angle in radians.
   * @param {number} y - The y value.
   * @return {Vector3} A reference to this vector.
   */
  setFromCylindricalCoords(radius, theta, y) {
    this.x = radius * Math.sin(theta);
    this.y = y;
    this.z = radius * Math.cos(theta);
    return this;
  }
  /**
   * Sets the vector components to the position elements of the
   * given transformation matrix.
   *
   * @param {Matrix4} m - The 4x4 matrix.
   * @return {Vector3} A reference to this vector.
   */
  setFromMatrixPosition(m) {
    const e = m.elements;
    this.x = e[12];
    this.y = e[13];
    this.z = e[14];
    return this;
  }
  /**
   * Sets the vector components to the scale elements of the
   * given transformation matrix.
   *
   * @param {Matrix4} m - The 4x4 matrix.
   * @return {Vector3} A reference to this vector.
   */
  setFromMatrixScale(m) {
    const sx = this.setFromMatrixColumn(m, 0).length();
    const sy = this.setFromMatrixColumn(m, 1).length();
    const sz = this.setFromMatrixColumn(m, 2).length();
    this.x = sx;
    this.y = sy;
    this.z = sz;
    return this;
  }
  /**
   * Sets the vector components from the specified matrix column.
   *
   * @param {Matrix4} m - The 4x4 matrix.
   * @param {number} index - The column index.
   * @return {Vector3} A reference to this vector.
   */
  setFromMatrixColumn(m, index) {
    return this.fromArray(m.elements, index * 4);
  }
  /**
   * Sets the vector components from the specified matrix column.
   *
   * @param {Matrix3} m - The 3x3 matrix.
   * @param {number} index - The column index.
   * @return {Vector3} A reference to this vector.
   */
  setFromMatrix3Column(m, index) {
    return this.fromArray(m.elements, index * 3);
  }
  /**
   * Sets the vector components from the given Euler angles.
   *
   * @param {Euler} e - The Euler angles to set.
   * @return {Vector3} A reference to this vector.
   */
  setFromEuler(e) {
    this.x = e._x;
    this.y = e._y;
    this.z = e._z;
    return this;
  }
  /**
   * Sets the vector components from the RGB components of the
   * given color.
   *
   * @param {Color} c - The color to set.
   * @return {Vector3} A reference to this vector.
   */
  setFromColor(c) {
    this.x = c.r;
    this.y = c.g;
    this.z = c.b;
    return this;
  }
  /**
   * Returns `true` if this vector is equal with the given one.
   *
   * @param {Vector3} v - The vector to test for equality.
   * @return {boolean} Whether this vector is equal with the given one.
   */
  equals(v) {
    return v.x === this.x && v.y === this.y && v.z === this.z;
  }
  /**
   * Sets this vector's x value to be `array[ offset ]`, y value to be `array[ offset + 1 ]`
   * and z value to be `array[ offset + 2 ]`.
   *
   * @param {Array<number>} array - An array holding the vector component values.
   * @param {number} [offset=0] - The offset into the array.
   * @return {Vector3} A reference to this vector.
   */
  fromArray(array, offset = 0) {
    this.x = array[offset];
    this.y = array[offset + 1];
    this.z = array[offset + 2];
    return this;
  }
  /**
   * Writes the components of this vector to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param {Array<number>} [array=[]] - The target array holding the vector components.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Array<number>} The vector components.
   */
  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    return array;
  }
  /**
   * Sets the components of this vector from the given buffer attribute.
   *
   * @param {BufferAttribute} attribute - The buffer attribute holding vector data.
   * @param {number} index - The index into the attribute.
   * @return {Vector3} A reference to this vector.
   */
  fromBufferAttribute(attribute, index) {
    this.x = attribute.getX(index);
    this.y = attribute.getY(index);
    this.z = attribute.getZ(index);
    return this;
  }
  /**
   * Sets each component of this vector to a pseudo-random value between `0` and
   * `1`, excluding `1`.
   *
   * @return {Vector3} A reference to this vector.
   */
  random() {
    this.x = Math.random();
    this.y = Math.random();
    this.z = Math.random();
    return this;
  }
  /**
   * Sets this vector to a uniformly random point on a unit sphere.
   *
   * @return {Vector3} A reference to this vector.
   */
  randomDirection() {
    const theta = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    const c = Math.sqrt(1 - u * u);
    this.x = c * Math.cos(theta);
    this.y = u;
    this.z = c * Math.sin(theta);
    return this;
  }
  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
    yield this.z;
  }
};
var _vector = /* @__PURE__ */ new Vector3();
var _quaternion = /* @__PURE__ */ new Quaternion();

// node_modules/three/src/math/Matrix4.js
var Matrix4 = class _Matrix4 {
  static {
    _Matrix4.prototype.isMatrix4 = true;
  }
  /**
   * Constructs a new 4x4 matrix. The arguments are supposed to be
   * in row-major order. If no arguments are provided, the constructor
   * initializes the matrix as an identity matrix.
   *
   * @param {number} [n11] - 1-1 matrix element.
   * @param {number} [n12] - 1-2 matrix element.
   * @param {number} [n13] - 1-3 matrix element.
   * @param {number} [n14] - 1-4 matrix element.
   * @param {number} [n21] - 2-1 matrix element.
   * @param {number} [n22] - 2-2 matrix element.
   * @param {number} [n23] - 2-3 matrix element.
   * @param {number} [n24] - 2-4 matrix element.
   * @param {number} [n31] - 3-1 matrix element.
   * @param {number} [n32] - 3-2 matrix element.
   * @param {number} [n33] - 3-3 matrix element.
   * @param {number} [n34] - 3-4 matrix element.
   * @param {number} [n41] - 4-1 matrix element.
   * @param {number} [n42] - 4-2 matrix element.
   * @param {number} [n43] - 4-3 matrix element.
   * @param {number} [n44] - 4-4 matrix element.
   */
  constructor(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
    this.elements = [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ];
    if (n11 !== void 0) {
      this.set(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44);
    }
  }
  /**
   * Sets the elements of the matrix.The arguments are supposed to be
   * in row-major order.
   *
   * @param {number} [n11] - 1-1 matrix element.
   * @param {number} [n12] - 1-2 matrix element.
   * @param {number} [n13] - 1-3 matrix element.
   * @param {number} [n14] - 1-4 matrix element.
   * @param {number} [n21] - 2-1 matrix element.
   * @param {number} [n22] - 2-2 matrix element.
   * @param {number} [n23] - 2-3 matrix element.
   * @param {number} [n24] - 2-4 matrix element.
   * @param {number} [n31] - 3-1 matrix element.
   * @param {number} [n32] - 3-2 matrix element.
   * @param {number} [n33] - 3-3 matrix element.
   * @param {number} [n34] - 3-4 matrix element.
   * @param {number} [n41] - 4-1 matrix element.
   * @param {number} [n42] - 4-2 matrix element.
   * @param {number} [n43] - 4-3 matrix element.
   * @param {number} [n44] - 4-4 matrix element.
   * @return {Matrix4} A reference to this matrix.
   */
  set(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
    const te = this.elements;
    te[0] = n11;
    te[4] = n12;
    te[8] = n13;
    te[12] = n14;
    te[1] = n21;
    te[5] = n22;
    te[9] = n23;
    te[13] = n24;
    te[2] = n31;
    te[6] = n32;
    te[10] = n33;
    te[14] = n34;
    te[3] = n41;
    te[7] = n42;
    te[11] = n43;
    te[15] = n44;
    return this;
  }
  /**
   * Sets this matrix to the 4x4 identity matrix.
   *
   * @return {Matrix4} A reference to this matrix.
   */
  identity() {
    this.set(
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    );
    return this;
  }
  /**
   * Returns a matrix with copied values from this instance.
   *
   * @return {Matrix4} A clone of this instance.
   */
  clone() {
    return new _Matrix4().fromArray(this.elements);
  }
  /**
   * Copies the values of the given matrix to this instance.
   *
   * @param {Matrix4} m - The matrix to copy.
   * @return {Matrix4} A reference to this matrix.
   */
  copy(m) {
    const te = this.elements;
    const me = m.elements;
    te[0] = me[0];
    te[1] = me[1];
    te[2] = me[2];
    te[3] = me[3];
    te[4] = me[4];
    te[5] = me[5];
    te[6] = me[6];
    te[7] = me[7];
    te[8] = me[8];
    te[9] = me[9];
    te[10] = me[10];
    te[11] = me[11];
    te[12] = me[12];
    te[13] = me[13];
    te[14] = me[14];
    te[15] = me[15];
    return this;
  }
  /**
   * Copies the translation component of the given matrix
   * into this matrix's translation component.
   *
   * @param {Matrix4} m - The matrix to copy the translation component.
   * @return {Matrix4} A reference to this matrix.
   */
  copyPosition(m) {
    const te = this.elements, me = m.elements;
    te[12] = me[12];
    te[13] = me[13];
    te[14] = me[14];
    return this;
  }
  /**
   * Set the upper 3x3 elements of this matrix to the values of given 3x3 matrix.
   *
   * @param {Matrix3} m - The 3x3 matrix.
   * @return {Matrix4} A reference to this matrix.
   */
  setFromMatrix3(m) {
    const me = m.elements;
    this.set(
      me[0],
      me[3],
      me[6],
      0,
      me[1],
      me[4],
      me[7],
      0,
      me[2],
      me[5],
      me[8],
      0,
      0,
      0,
      0,
      1
    );
    return this;
  }
  /**
   * Extracts the basis vectors of this matrix into the three vectors provided.
   *
   * @param {Vector3} xAxis - The basis's x axis.
   * @param {Vector3} yAxis - The basis's y axis.
   * @param {Vector3} zAxis - The basis's z axis.
   * @return {Matrix4} A reference to this matrix.
   */
  extractBasis(xAxis, yAxis, zAxis) {
    if (this.determinantAffine() === 0) {
      xAxis.set(1, 0, 0);
      yAxis.set(0, 1, 0);
      zAxis.set(0, 0, 1);
      return this;
    }
    xAxis.setFromMatrixColumn(this, 0);
    yAxis.setFromMatrixColumn(this, 1);
    zAxis.setFromMatrixColumn(this, 2);
    return this;
  }
  /**
   * Sets the given basis vectors to this matrix.
   *
   * @param {Vector3} xAxis - The basis's x axis.
   * @param {Vector3} yAxis - The basis's y axis.
   * @param {Vector3} zAxis - The basis's z axis.
   * @return {Matrix4} A reference to this matrix.
   */
  makeBasis(xAxis, yAxis, zAxis) {
    this.set(
      xAxis.x,
      yAxis.x,
      zAxis.x,
      0,
      xAxis.y,
      yAxis.y,
      zAxis.y,
      0,
      xAxis.z,
      yAxis.z,
      zAxis.z,
      0,
      0,
      0,
      0,
      1
    );
    return this;
  }
  /**
   * Extracts the rotation component of the given matrix
   * into this matrix's rotation component.
   *
   * Note: This method does not support reflection matrices.
   *
   * @param {Matrix4} m - The matrix.
   * @return {Matrix4} A reference to this matrix.
   */
  extractRotation(m) {
    if (m.determinantAffine() === 0) {
      return this.identity();
    }
    const te = this.elements;
    const me = m.elements;
    const scaleX = 1 / _v1.setFromMatrixColumn(m, 0).length();
    const scaleY = 1 / _v1.setFromMatrixColumn(m, 1).length();
    const scaleZ = 1 / _v1.setFromMatrixColumn(m, 2).length();
    te[0] = me[0] * scaleX;
    te[1] = me[1] * scaleX;
    te[2] = me[2] * scaleX;
    te[3] = 0;
    te[4] = me[4] * scaleY;
    te[5] = me[5] * scaleY;
    te[6] = me[6] * scaleY;
    te[7] = 0;
    te[8] = me[8] * scaleZ;
    te[9] = me[9] * scaleZ;
    te[10] = me[10] * scaleZ;
    te[11] = 0;
    te[12] = 0;
    te[13] = 0;
    te[14] = 0;
    te[15] = 1;
    return this;
  }
  /**
   * Sets the rotation component (the upper left 3x3 matrix) of this matrix to
   * the rotation specified by the given Euler angles. The rest of
   * the matrix is set to the identity. Depending on the {@link Euler#order},
   * there are six possible outcomes. See [this page](https://en.wikipedia.org/wiki/Euler_angles#Rotation_matrix)
   * for a complete list.
   *
   * @param {Euler} euler - The Euler angles.
   * @return {Matrix4} A reference to this matrix.
   */
  makeRotationFromEuler(euler) {
    const te = this.elements;
    const x = euler.x, y = euler.y, z = euler.z;
    const a = Math.cos(x), b = Math.sin(x);
    const c = Math.cos(y), d = Math.sin(y);
    const e = Math.cos(z), f = Math.sin(z);
    if (euler.order === "XYZ") {
      const ae = a * e, af = a * f, be = b * e, bf = b * f;
      te[0] = c * e;
      te[4] = -c * f;
      te[8] = d;
      te[1] = af + be * d;
      te[5] = ae - bf * d;
      te[9] = -b * c;
      te[2] = bf - ae * d;
      te[6] = be + af * d;
      te[10] = a * c;
    } else if (euler.order === "YXZ") {
      const ce = c * e, cf = c * f, de = d * e, df = d * f;
      te[0] = ce + df * b;
      te[4] = de * b - cf;
      te[8] = a * d;
      te[1] = a * f;
      te[5] = a * e;
      te[9] = -b;
      te[2] = cf * b - de;
      te[6] = df + ce * b;
      te[10] = a * c;
    } else if (euler.order === "ZXY") {
      const ce = c * e, cf = c * f, de = d * e, df = d * f;
      te[0] = ce - df * b;
      te[4] = -a * f;
      te[8] = de + cf * b;
      te[1] = cf + de * b;
      te[5] = a * e;
      te[9] = df - ce * b;
      te[2] = -a * d;
      te[6] = b;
      te[10] = a * c;
    } else if (euler.order === "ZYX") {
      const ae = a * e, af = a * f, be = b * e, bf = b * f;
      te[0] = c * e;
      te[4] = be * d - af;
      te[8] = ae * d + bf;
      te[1] = c * f;
      te[5] = bf * d + ae;
      te[9] = af * d - be;
      te[2] = -d;
      te[6] = b * c;
      te[10] = a * c;
    } else if (euler.order === "YZX") {
      const ac = a * c, ad = a * d, bc = b * c, bd = b * d;
      te[0] = c * e;
      te[4] = bd - ac * f;
      te[8] = bc * f + ad;
      te[1] = f;
      te[5] = a * e;
      te[9] = -b * e;
      te[2] = -d * e;
      te[6] = ad * f + bc;
      te[10] = ac - bd * f;
    } else if (euler.order === "XZY") {
      const ac = a * c, ad = a * d, bc = b * c, bd = b * d;
      te[0] = c * e;
      te[4] = -f;
      te[8] = d * e;
      te[1] = ac * f + bd;
      te[5] = a * e;
      te[9] = ad * f - bc;
      te[2] = bc * f - ad;
      te[6] = b * e;
      te[10] = bd * f + ac;
    }
    te[3] = 0;
    te[7] = 0;
    te[11] = 0;
    te[12] = 0;
    te[13] = 0;
    te[14] = 0;
    te[15] = 1;
    return this;
  }
  /**
   * Sets the rotation component of this matrix to the rotation specified by
   * the given Quaternion as outlined [here](https://en.wikipedia.org/wiki/Rotation_matrix#Quaternion)
   * The rest of the matrix is set to the identity.
   *
   * @param {Quaternion} q - The Quaternion.
   * @return {Matrix4} A reference to this matrix.
   */
  makeRotationFromQuaternion(q) {
    return this.compose(_zero, q, _one);
  }
  /**
   * Sets the rotation component of the transformation matrix, looking from `eye` towards
   * `target`, and oriented by the up-direction.
   *
   * @param {Vector3} eye - The eye vector.
   * @param {Vector3} target - The target vector.
   * @param {Vector3} up - The up vector.
   * @return {Matrix4} A reference to this matrix.
   */
  lookAt(eye, target, up) {
    const te = this.elements;
    _z.subVectors(eye, target);
    if (_z.lengthSq() === 0) {
      _z.z = 1;
    }
    _z.normalize();
    _x.crossVectors(up, _z);
    if (_x.lengthSq() === 0) {
      if (Math.abs(up.z) === 1) {
        _z.x += 1e-4;
      } else {
        _z.z += 1e-4;
      }
      _z.normalize();
      _x.crossVectors(up, _z);
    }
    _x.normalize();
    _y.crossVectors(_z, _x);
    te[0] = _x.x;
    te[4] = _y.x;
    te[8] = _z.x;
    te[1] = _x.y;
    te[5] = _y.y;
    te[9] = _z.y;
    te[2] = _x.z;
    te[6] = _y.z;
    te[10] = _z.z;
    return this;
  }
  /**
   * Post-multiplies this matrix by the given 4x4 matrix.
   *
   * @param {Matrix4} m - The matrix to multiply with.
   * @return {Matrix4} A reference to this matrix.
   */
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  /**
   * Pre-multiplies this matrix by the given 4x4 matrix.
   *
   * @param {Matrix4} m - The matrix to multiply with.
   * @return {Matrix4} A reference to this matrix.
   */
  premultiply(m) {
    return this.multiplyMatrices(m, this);
  }
  /**
   * Multiples the given 4x4 matrices and stores the result
   * in this matrix.
   *
   * @param {Matrix4} a - The first matrix.
   * @param {Matrix4} b - The second matrix.
   * @return {Matrix4} A reference to this matrix.
   */
  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;
    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    return this;
  }
  /**
   * Multiplies every component of the matrix by the given scalar.
   *
   * @param {number} s - The scalar.
   * @return {Matrix4} A reference to this matrix.
   */
  multiplyScalar(s) {
    const te = this.elements;
    te[0] *= s;
    te[4] *= s;
    te[8] *= s;
    te[12] *= s;
    te[1] *= s;
    te[5] *= s;
    te[9] *= s;
    te[13] *= s;
    te[2] *= s;
    te[6] *= s;
    te[10] *= s;
    te[14] *= s;
    te[3] *= s;
    te[7] *= s;
    te[11] *= s;
    te[15] *= s;
    return this;
  }
  /**
   * Computes and returns the determinant of this matrix.
   *
   * @return {number} The determinant.
   */
  determinant() {
    const te = this.elements;
    const n11 = te[0], n12 = te[4], n13 = te[8], n14 = te[12];
    const n21 = te[1], n22 = te[5], n23 = te[9], n24 = te[13];
    const n31 = te[2], n32 = te[6], n33 = te[10], n34 = te[14];
    const n41 = te[3], n42 = te[7], n43 = te[11], n44 = te[15];
    const t11 = n23 * n34 - n24 * n33;
    const t12 = n22 * n34 - n24 * n32;
    const t13 = n22 * n33 - n23 * n32;
    const t21 = n21 * n34 - n24 * n31;
    const t22 = n21 * n33 - n23 * n31;
    const t23 = n21 * n32 - n22 * n31;
    return n11 * (n42 * t11 - n43 * t12 + n44 * t13) - n12 * (n41 * t11 - n43 * t21 + n44 * t22) + n13 * (n41 * t12 - n42 * t21 + n44 * t23) - n14 * (n41 * t13 - n42 * t22 + n43 * t23);
  }
  /**
   * Computes and returns the determinant of the 4x4 matrix, but assumes the
   * matrix is affine, saving some computations.
   *
   * For affine matrices (like an object's world matrix), this value equals the
   * full 4x4 {@link Matrix4#determinant} but is cheaper to compute.
   *
   * Assumes the bottom row is [0, 0, 0, 1].
   *
   * @return {number} The determinant of the matrix.
   */
  determinantAffine() {
    const te = this.elements;
    const n11 = te[0], n12 = te[4], n13 = te[8];
    const n21 = te[1], n22 = te[5], n23 = te[9];
    const n31 = te[2], n32 = te[6], n33 = te[10];
    return n11 * (n22 * n33 - n23 * n32) - n12 * (n21 * n33 - n23 * n31) + n13 * (n21 * n32 - n22 * n31);
  }
  /**
   * Transposes this matrix in place.
   *
   * @return {Matrix4} A reference to this matrix.
   */
  transpose() {
    const te = this.elements;
    let tmp;
    tmp = te[1];
    te[1] = te[4];
    te[4] = tmp;
    tmp = te[2];
    te[2] = te[8];
    te[8] = tmp;
    tmp = te[6];
    te[6] = te[9];
    te[9] = tmp;
    tmp = te[3];
    te[3] = te[12];
    te[12] = tmp;
    tmp = te[7];
    te[7] = te[13];
    te[13] = tmp;
    tmp = te[11];
    te[11] = te[14];
    te[14] = tmp;
    return this;
  }
  /**
   * Sets the position component for this matrix from the given vector,
   * without affecting the rest of the matrix.
   *
   * @param {number|Vector3} x - The x component of the vector or alternatively the vector object.
   * @param {number} y - The y component of the vector.
   * @param {number} z - The z component of the vector.
   * @return {Matrix4} A reference to this matrix.
   */
  setPosition(x, y, z) {
    const te = this.elements;
    if (x.isVector3) {
      te[12] = x.x;
      te[13] = x.y;
      te[14] = x.z;
    } else {
      te[12] = x;
      te[13] = y;
      te[14] = z;
    }
    return this;
  }
  /**
   * Inverts this matrix, using the [analytic method](https://en.wikipedia.org/wiki/Invertible_matrix#Analytic_solution).
   * You can not invert with a determinant of zero. If you attempt this, the method produces
   * a zero matrix instead.
   *
   * @return {Matrix4} A reference to this matrix.
   */
  invert() {
    const te = this.elements, n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3], n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7], n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11], n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15], t1 = n11 * n22 - n21 * n12, t2 = n11 * n32 - n31 * n12, t3 = n11 * n42 - n41 * n12, t4 = n21 * n32 - n31 * n22, t5 = n21 * n42 - n41 * n22, t6 = n31 * n42 - n41 * n32, t7 = n13 * n24 - n23 * n14, t8 = n13 * n34 - n33 * n14, t9 = n13 * n44 - n43 * n14, t10 = n23 * n34 - n33 * n24, t11 = n23 * n44 - n43 * n24, t12 = n33 * n44 - n43 * n34;
    const det = t1 * t12 - t2 * t11 + t3 * t10 + t4 * t9 - t5 * t8 + t6 * t7;
    if (det === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    const detInv = 1 / det;
    te[0] = (n22 * t12 - n32 * t11 + n42 * t10) * detInv;
    te[1] = (n31 * t11 - n21 * t12 - n41 * t10) * detInv;
    te[2] = (n24 * t6 - n34 * t5 + n44 * t4) * detInv;
    te[3] = (n33 * t5 - n23 * t6 - n43 * t4) * detInv;
    te[4] = (n32 * t9 - n12 * t12 - n42 * t8) * detInv;
    te[5] = (n11 * t12 - n31 * t9 + n41 * t8) * detInv;
    te[6] = (n34 * t3 - n14 * t6 - n44 * t2) * detInv;
    te[7] = (n13 * t6 - n33 * t3 + n43 * t2) * detInv;
    te[8] = (n12 * t11 - n22 * t9 + n42 * t7) * detInv;
    te[9] = (n21 * t9 - n11 * t11 - n41 * t7) * detInv;
    te[10] = (n14 * t5 - n24 * t3 + n44 * t1) * detInv;
    te[11] = (n23 * t3 - n13 * t5 - n43 * t1) * detInv;
    te[12] = (n22 * t8 - n12 * t10 - n32 * t7) * detInv;
    te[13] = (n11 * t10 - n21 * t8 + n31 * t7) * detInv;
    te[14] = (n24 * t2 - n14 * t4 - n34 * t1) * detInv;
    te[15] = (n13 * t4 - n23 * t2 + n33 * t1) * detInv;
    return this;
  }
  /**
   * Scales each of the first three columns of this matrix by the corresponding component of the given vector.
   *
   * @param {Vector3} v - The scale vector.
   * @return {Matrix4} A reference to this matrix.
   */
  scale(v) {
    const te = this.elements;
    const x = v.x, y = v.y, z = v.z;
    te[0] *= x;
    te[4] *= y;
    te[8] *= z;
    te[1] *= x;
    te[5] *= y;
    te[9] *= z;
    te[2] *= x;
    te[6] *= y;
    te[10] *= z;
    te[3] *= x;
    te[7] *= y;
    te[11] *= z;
    return this;
  }
  /**
   * Gets the maximum scale value of the three axes.
   *
   * @return {number} The maximum scale.
   */
  getMaxScaleOnAxis() {
    const te = this.elements;
    const scaleXSq = te[0] * te[0] + te[1] * te[1] + te[2] * te[2];
    const scaleYSq = te[4] * te[4] + te[5] * te[5] + te[6] * te[6];
    const scaleZSq = te[8] * te[8] + te[9] * te[9] + te[10] * te[10];
    return Math.sqrt(Math.max(scaleXSq, scaleYSq, scaleZSq));
  }
  /**
   * Sets this matrix as a translation transform from the given vector.
   *
   * @param {number|Vector3} x - The amount to translate in the X axis or alternatively a translation vector.
   * @param {number} y - The amount to translate in the Y axis.
   * @param {number} z - The amount to translate in the z axis.
   * @return {Matrix4} A reference to this matrix.
   */
  makeTranslation(x, y, z) {
    if (x.isVector3) {
      this.set(
        1,
        0,
        0,
        x.x,
        0,
        1,
        0,
        x.y,
        0,
        0,
        1,
        x.z,
        0,
        0,
        0,
        1
      );
    } else {
      this.set(
        1,
        0,
        0,
        x,
        0,
        1,
        0,
        y,
        0,
        0,
        1,
        z,
        0,
        0,
        0,
        1
      );
    }
    return this;
  }
  /**
   * Sets this matrix as a rotational transformation around the X axis by
   * the given angle.
   *
   * @param {number} theta - The rotation in radians.
   * @return {Matrix4} A reference to this matrix.
   */
  makeRotationX(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    this.set(
      1,
      0,
      0,
      0,
      0,
      c,
      -s,
      0,
      0,
      s,
      c,
      0,
      0,
      0,
      0,
      1
    );
    return this;
  }
  /**
   * Sets this matrix as a rotational transformation around the Y axis by
   * the given angle.
   *
   * @param {number} theta - The rotation in radians.
   * @return {Matrix4} A reference to this matrix.
   */
  makeRotationY(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    this.set(
      c,
      0,
      s,
      0,
      0,
      1,
      0,
      0,
      -s,
      0,
      c,
      0,
      0,
      0,
      0,
      1
    );
    return this;
  }
  /**
   * Sets this matrix as a rotational transformation around the Z axis by
   * the given angle.
   *
   * @param {number} theta - The rotation in radians.
   * @return {Matrix4} A reference to this matrix.
   */
  makeRotationZ(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    this.set(
      c,
      -s,
      0,
      0,
      s,
      c,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    );
    return this;
  }
  /**
   * Sets this matrix as a rotational transformation around the given axis by
   * the given angle.
   *
   * @param {Vector3} axis - The normalized rotation axis.
   * @param {number} angle - The rotation in radians.
   * @return {Matrix4} A reference to this matrix.
   */
  makeRotationAxis(axis, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    const x = axis.x, y = axis.y, z = axis.z;
    const tx = t * x, ty = t * y;
    this.set(
      tx * x + c,
      tx * y - s * z,
      tx * z + s * y,
      0,
      tx * y + s * z,
      ty * y + c,
      ty * z - s * x,
      0,
      tx * z - s * y,
      ty * z + s * x,
      t * z * z + c,
      0,
      0,
      0,
      0,
      1
    );
    return this;
  }
  /**
   * Sets this matrix as a scale transformation.
   *
   * @param {number} x - The amount to scale in the X axis.
   * @param {number} y - The amount to scale in the Y axis.
   * @param {number} z - The amount to scale in the Z axis.
   * @return {Matrix4} A reference to this matrix.
   */
  makeScale(x, y, z) {
    this.set(
      x,
      0,
      0,
      0,
      0,
      y,
      0,
      0,
      0,
      0,
      z,
      0,
      0,
      0,
      0,
      1
    );
    return this;
  }
  /**
   * Sets this matrix as a shear transformation.
   *
   * @param {number} xy - The amount to shear X by Y.
   * @param {number} xz - The amount to shear X by Z.
   * @param {number} yx - The amount to shear Y by X.
   * @param {number} yz - The amount to shear Y by Z.
   * @param {number} zx - The amount to shear Z by X.
   * @param {number} zy - The amount to shear Z by Y.
   * @return {Matrix4} A reference to this matrix.
   */
  makeShear(xy, xz, yx, yz, zx, zy) {
    this.set(
      1,
      yx,
      zx,
      0,
      xy,
      1,
      zy,
      0,
      xz,
      yz,
      1,
      0,
      0,
      0,
      0,
      1
    );
    return this;
  }
  /**
   * Sets this matrix to the transformation composed of the given position,
   * rotation (Quaternion) and scale.
   *
   * @param {Vector3} position - The position vector.
   * @param {Quaternion} quaternion - The rotation as a Quaternion.
   * @param {Vector3} scale - The scale vector.
   * @return {Matrix4} A reference to this matrix.
   */
  compose(position, quaternion, scale) {
    const te = this.elements;
    const x = quaternion._x, y = quaternion._y, z = quaternion._z, w = quaternion._w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = scale.x, sy = scale.y, sz = scale.z;
    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;
    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;
    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;
    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    return this;
  }
  /**
   * Decomposes this matrix into its position, rotation and scale components
   * and provides the result in the given objects.
   *
   * Note: Not all matrices are decomposable in this way. For example, if an
   * object has a non-uniformly scaled parent, then the object's world matrix
   * may not be decomposable, and this method may not be appropriate.
   *
   * @param {Vector3} position - The position vector.
   * @param {Quaternion} quaternion - The rotation as a Quaternion.
   * @param {Vector3} scale - The scale vector.
   * @return {Matrix4} A reference to this matrix.
   */
  decompose(position, quaternion, scale) {
    const te = this.elements;
    position.x = te[12];
    position.y = te[13];
    position.z = te[14];
    const det = this.determinantAffine();
    if (det === 0) {
      scale.set(1, 1, 1);
      quaternion.identity();
      return this;
    }
    let sx = _v1.set(te[0], te[1], te[2]).length();
    const sy = _v1.set(te[4], te[5], te[6]).length();
    const sz = _v1.set(te[8], te[9], te[10]).length();
    if (det < 0) sx = -sx;
    _m1.copy(this);
    const invSX = 1 / sx;
    const invSY = 1 / sy;
    const invSZ = 1 / sz;
    _m1.elements[0] *= invSX;
    _m1.elements[1] *= invSX;
    _m1.elements[2] *= invSX;
    _m1.elements[4] *= invSY;
    _m1.elements[5] *= invSY;
    _m1.elements[6] *= invSY;
    _m1.elements[8] *= invSZ;
    _m1.elements[9] *= invSZ;
    _m1.elements[10] *= invSZ;
    quaternion.setFromRotationMatrix(_m1);
    scale.x = sx;
    scale.y = sy;
    scale.z = sz;
    return this;
  }
  /**
   * Creates a perspective projection matrix. This is used internally by
   * {@link PerspectiveCamera#updateProjectionMatrix}.

   * @param {number} left - Left boundary of the viewing frustum at the near plane.
   * @param {number} right - Right boundary of the viewing frustum at the near plane.
   * @param {number} top - Top boundary of the viewing frustum at the near plane.
   * @param {number} bottom - Bottom boundary of the viewing frustum at the near plane.
   * @param {number} near - The distance from the camera to the near plane.
   * @param {number} far - The distance from the camera to the far plane.
   * @param {(WebGLCoordinateSystem|WebGPUCoordinateSystem)} [coordinateSystem=WebGLCoordinateSystem] - The coordinate system.
   * @param {boolean} [reversedDepth=false] - Whether to use a reversed depth.
   * @return {Matrix4} A reference to this matrix.
   */
  makePerspective(left, right, top, bottom, near, far, coordinateSystem = WebGLCoordinateSystem, reversedDepth = false) {
    const te = this.elements;
    const x = 2 * near / (right - left);
    const y = 2 * near / (top - bottom);
    const a = (right + left) / (right - left);
    const b = (top + bottom) / (top - bottom);
    let c, d;
    if (reversedDepth) {
      c = near / (far - near);
      d = far * near / (far - near);
    } else {
      if (coordinateSystem === WebGLCoordinateSystem) {
        c = -(far + near) / (far - near);
        d = -2 * far * near / (far - near);
      } else if (coordinateSystem === WebGPUCoordinateSystem) {
        c = -far / (far - near);
        d = -far * near / (far - near);
      } else {
        throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: " + coordinateSystem);
      }
    }
    te[0] = x;
    te[4] = 0;
    te[8] = a;
    te[12] = 0;
    te[1] = 0;
    te[5] = y;
    te[9] = b;
    te[13] = 0;
    te[2] = 0;
    te[6] = 0;
    te[10] = c;
    te[14] = d;
    te[3] = 0;
    te[7] = 0;
    te[11] = -1;
    te[15] = 0;
    return this;
  }
  /**
   * Creates a orthographic projection matrix. This is used internally by
   * {@link OrthographicCamera#updateProjectionMatrix}.

   * @param {number} left - Left boundary of the viewing frustum at the near plane.
   * @param {number} right - Right boundary of the viewing frustum at the near plane.
   * @param {number} top - Top boundary of the viewing frustum at the near plane.
   * @param {number} bottom - Bottom boundary of the viewing frustum at the near plane.
   * @param {number} near - The distance from the camera to the near plane.
   * @param {number} far - The distance from the camera to the far plane.
   * @param {(WebGLCoordinateSystem|WebGPUCoordinateSystem)} [coordinateSystem=WebGLCoordinateSystem] - The coordinate system.
   * @param {boolean} [reversedDepth=false] - Whether to use a reversed depth.
   * @return {Matrix4} A reference to this matrix.
   */
  makeOrthographic(left, right, top, bottom, near, far, coordinateSystem = WebGLCoordinateSystem, reversedDepth = false) {
    const te = this.elements;
    const x = 2 / (right - left);
    const y = 2 / (top - bottom);
    const a = -(right + left) / (right - left);
    const b = -(top + bottom) / (top - bottom);
    let c, d;
    if (reversedDepth) {
      c = 1 / (far - near);
      d = far / (far - near);
    } else {
      if (coordinateSystem === WebGLCoordinateSystem) {
        c = -2 / (far - near);
        d = -(far + near) / (far - near);
      } else if (coordinateSystem === WebGPUCoordinateSystem) {
        c = -1 / (far - near);
        d = -near / (far - near);
      } else {
        throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: " + coordinateSystem);
      }
    }
    te[0] = x;
    te[4] = 0;
    te[8] = 0;
    te[12] = a;
    te[1] = 0;
    te[5] = y;
    te[9] = 0;
    te[13] = b;
    te[2] = 0;
    te[6] = 0;
    te[10] = c;
    te[14] = d;
    te[3] = 0;
    te[7] = 0;
    te[11] = 0;
    te[15] = 1;
    return this;
  }
  /**
   * Returns `true` if this matrix is equal with the given one.
   *
   * @param {Matrix4} matrix - The matrix to test for equality.
   * @return {boolean} Whether this matrix is equal with the given one.
   */
  equals(matrix) {
    const te = this.elements;
    const me = matrix.elements;
    for (let i = 0; i < 16; i++) {
      if (te[i] !== me[i]) return false;
    }
    return true;
  }
  /**
   * Sets the elements of the matrix from the given array.
   *
   * @param {Array<number>} array - The matrix elements in column-major order.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Matrix4} A reference to this matrix.
   */
  fromArray(array, offset = 0) {
    for (let i = 0; i < 16; i++) {
      this.elements[i] = array[i + offset];
    }
    return this;
  }
  /**
   * Writes the elements of this matrix to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param {Array<number>} [array=[]] - The target array holding the matrix elements in column-major order.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Array<number>} The matrix elements in column-major order.
   */
  toArray(array = [], offset = 0) {
    const te = this.elements;
    array[offset] = te[0];
    array[offset + 1] = te[1];
    array[offset + 2] = te[2];
    array[offset + 3] = te[3];
    array[offset + 4] = te[4];
    array[offset + 5] = te[5];
    array[offset + 6] = te[6];
    array[offset + 7] = te[7];
    array[offset + 8] = te[8];
    array[offset + 9] = te[9];
    array[offset + 10] = te[10];
    array[offset + 11] = te[11];
    array[offset + 12] = te[12];
    array[offset + 13] = te[13];
    array[offset + 14] = te[14];
    array[offset + 15] = te[15];
    return array;
  }
};
var _v1 = /* @__PURE__ */ new Vector3();
var _m1 = /* @__PURE__ */ new Matrix4();
var _zero = /* @__PURE__ */ new Vector3(0, 0, 0);
var _one = /* @__PURE__ */ new Vector3(1, 1, 1);
var _x = /* @__PURE__ */ new Vector3();
var _y = /* @__PURE__ */ new Vector3();
var _z = /* @__PURE__ */ new Vector3();

// src/import/ifc.ts
var namedMetricTypes = {
  IFCQUANTITYLENGTH: "length",
  IFCQUANTITYAREA: "area",
  IFCQUANTITYVOLUME: "volume"
};
var namedQuantityUnits = { length: ["LENGTHUNIT", "METRE"], area: ["AREAUNIT", "SQUARE_METRE"], volume: ["VOLUMEUNIT", "CUBIC_METRE"] };
var IFC_IMPORT_LIMITS = Object.freeze({
  fileBytes: 100 * 1024 ** 2,
  products: 2e5,
  lines: 2e6,
  propertyValues: 2e6,
  propertyTextBytes: 64 * 1024 ** 2,
  triangles: 5e6,
  geometryBytes: 256 * 1024 ** 2,
  placements: 5e5
});
var dict = () => /* @__PURE__ */ Object.create(null);
var identity = () => new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
var Y_TO_Z = new Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function ref(value) {
  return record(value) && value.type === REF && Number.isSafeInteger(value.value) && Number(value.value) > 0 ? Number(value.value) : void 0;
}
function refs(value) {
  return (Array.isArray(value) ? value : [value]).flatMap((item) => {
    const id = ref(item);
    return id === void 0 ? [] : [id];
  });
}
function simple(value) {
  return record(value) && "value" in value ? value.value : value;
}
function text(value) {
  const v = simple(value);
  return typeof v === "string" ? v : "";
}
function release(value) {
  const disposable = value;
  disposable?.delete?.();
}
async function parseIfc(bytes, name, options) {
  const limits = { ...IFC_IMPORT_LIMITS, ...options.limits };
  for (const key of Object.keys(IFC_IMPORT_LIMITS)) {
    if (!Number.isSafeInteger(limits[key]) || limits[key] <= 0 || limits[key] > IFC_IMPORT_LIMITS[key])
      throw new Error(`IFC \u5BFC\u5165\u9884\u7B97\u65E0\u6548\uFF1A${key}`);
  }
  if (!bytes.byteLength || bytes.byteLength > limits.fileBytes) throw new Error("IFC \u6587\u4EF6\u4E3A\u7A7A\u6216\u8D85\u8FC7\u5F53\u524D\u5BFC\u5165\u5927\u5C0F\u4E0A\u9650\u3002");
  const header = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 256 * 1024)));
  if (!/^\s*ISO-10303-21\s*;/iu.test(header)) throw new Error("\u4EC5\u652F\u6301 IFC STEP \u6587\u4EF6\uFF1B\u6B64\u6587\u4EF6\u4E0D\u662F\u6709\u6548\u7684 STEP \u5F00\u5934\u3002");
  const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 4096)));
  if (!/ENDSEC\s*;\s*END-ISO-10303-21\s*;\s*$/iu.test(tail)) throw new Error("IFC STEP \u7ED3\u675F\u6807\u8BB0\u7F3A\u5931\uFF0C\u6587\u4EF6\u53EF\u80FD\u4E0D\u5B8C\u6574\u3002");
  const declaredSchema = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'\s*\)\s*\)\s*;/iu.exec(header)?.[1]?.toUpperCase();
  if (declaredSchema !== "IFC2X3" && declaredSchema !== "IFC4")
    throw new Error(`\u5F53\u524D\u4EC5\u652F\u6301 IFC2X3 \u548C IFC4\uFF0C\u6587\u4EF6\u58F0\u660E\u4E3A ${declaredSchema ?? "\u672A\u77E5\u6216\u65E0\u6548 schema"}\u3002`);
  if (!(options.metadataOnly && options.wasmPath === void 0) && (typeof options.wasmPath !== "string" || !options.wasmPath.trim() || /[\u0000-\u001f]/u.test(options.wasmPath)))
    throw new Error("IFC \u89E3\u6790\u5668 WASM \u76EE\u5F55\u672A\u914D\u7F6E\u3002");
  const progress = (phase, value) => options.onProgress?.({ phase, progress: value });
  const api = new IfcAPI();
  let modelID;
  let valueCount = 0, textBytes = 0, lineReads = 0, placementCount = 0, geometryBytes = 0, triangles = 0;
  const warnings = [];
  let warningCount = 0, unsupportedDefinitions = 0, allocatedBufferBytes = 0;
  const warn2 = (message) => {
    warningCount++;
    if (warnings.length < 200) warnings.push(message);
  };
  const failBudget = (kind) => {
    throw new Error(`IFC ${kind}\u8D85\u8FC7\u5F53\u524D\u5BFC\u5165\u9884\u7B97\uFF1B\u672A\u751F\u6210\u90E8\u5206\u5BA1\u6838\u7ED3\u679C\uFF0C\u8BF7\u62C6\u5206\u6A21\u578B\u540E\u91CD\u8BD5\u3002`);
  };
  const allocator = (create, bytesPerElement) => {
    const capacity = 256 * 1024 / bytesPerElement;
    let page = create(0), offset = 0;
    const allocate = (length) => {
      allocatedBufferBytes += length * bytesPerElement;
      if (allocatedBufferBytes > limits.geometryBytes + limits.placements * 128 + 3 * 256 * 1024) failBudget("\u8F93\u51FA\u7F13\u51B2\u5185\u5B58");
      return create(length);
    };
    return (length) => {
      if (length > capacity) return allocate(length);
      if (offset + length > page.length) {
        page = allocate(capacity);
        offset = 0;
      }
      const result = page.subarray(offset, offset + length);
      offset += length;
      return result;
    };
  };
  const floats = allocator((length) => new Float32Array(length), 4);
  const integers = allocator((length) => new Uint32Array(length), 4);
  const matrices = allocator((length) => new Float64Array(length), 8);
  const identityMatrix = identity();
  const countValue = (v) => {
    if (++valueCount > limits.propertyValues) failBudget("\u5C5E\u6027\u6570\u636E");
    if (typeof v === "string") {
      textBytes += v.length * 2;
      if (textBytes > limits.propertyTextBytes) failBudget("\u5C5E\u6027\u6587\u672C");
    }
  };
  const scalar = (value, depth = 0) => {
    countValue(value);
    if (depth > 16) throw new Error("IFC \u5C5E\u6027\u5D4C\u5957\u8D85\u8FC7\u652F\u6301\u6DF1\u5EA6\u3002");
    if (value == null) return null;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("IFC \u5C5E\u6027\u5305\u542B\u65E0\u6548\u6570\u5B57\u3002");
      return value;
    }
    if (typeof value === "string" || typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.map((v) => scalar(v, depth + 1));
    if (record(value) && value.type === REF) return { expressID: ref(value), reference: true };
    if (record(value) && "value" in value) return scalar(value.value, depth + 1);
    throw new Error("IFC \u5C5E\u6027\u503C\u65E0\u6CD5\u53EF\u9760\u8BFB\u53D6\u3002");
  };
  try {
    progress("\u521D\u59CB\u5316 IFC \u89E3\u6790\u5668", 0.01);
    const directory = options.wasmPath?.replaceAll("\\", "/").replace(/\/?$/u, "/");
    await api.Init(directory ? (file) => `${directory}${file}` : void 0, true);
    progress("\u89E3\u6790 IFC STEP \u6570\u636E", 0.04);
    modelID = api.OpenModel(bytes, {
      COORDINATE_TO_ORIGIN: true,
      ALLOW_INCOMPATIBLE_SCHEMA_ALIASES: false,
      MEMORY_LIMIT: 512 * 1024 ** 2,
      CIRCLE_SEGMENTS: 24
    });
    if (modelID < 0) {
      modelID = void 0;
      throw new Error("IFC \u89E3\u6790\u5931\u8D25\uFF1B\u8BF7\u68C0\u67E5\u6587\u4EF6\u5B8C\u6574\u6027\u548C schema\u3002");
    }
    const mid = modelID;
    if (api.GetModelSchema(mid) !== declaredSchema) throw new Error("IFC \u89E3\u6790 schema \u4E0E\u6587\u4EF6\u58F0\u660E\u4E0D\u4E00\u81F4\u3002");
    const allLines = api.GetAllLines(mid);
    try {
      if (allLines.size() > limits.lines) failBudget("\u5B9E\u4F53\u884C\u6570");
    } finally {
      release(allLines);
    }
    const read = (id) => {
      if (++lineReads > limits.lines * 4) failBudget("\u5B9E\u4F53\u8BFB\u53D6\u6B21\u6570");
      const result = api.GetLine(mid, id, false);
      if (!result || result.expressID !== id) throw new Error(`\u65E0\u6CD5\u8BFB\u53D6 IFC \u5B9E\u4F53 #${id}\u3002`);
      return result;
    };
    const ids = (type, inherited = false) => {
      const vector = api.GetLineIDsWithType(mid, type, inherited);
      try {
        if (vector.size() > limits.lines) failBudget("\u5B9E\u4F53\u96C6\u5408");
        return Array.from({ length: vector.size() }, (_, i) => vector.get(i));
      } finally {
        release(vector);
      }
    };
    const typeName = (line) => api.GetNameFromTypeCode(line.type).toUpperCase();
    const projects = ids(IFCPROJECT);
    if (projects.length !== 1) throw new Error("\u5F53\u524D IFC \u5BFC\u5165\u8981\u6C42\u4E00\u4E2A IfcProject\uFF0C\u4EE5\u660E\u786E\u6A21\u578B\u5355\u4F4D\u3002");
    const unitAssignment = ref(read(projects[0]).UnitsInContext);
    if (!unitAssignment) throw new Error("IFC \u9879\u76EE\u672A\u58F0\u660E\u5355\u4F4D\uFF0C\u4E0D\u80FD\u53EF\u9760\u786E\u5B9A\u51E0\u4F55\u5C3A\u5EA6\u3002");
    const unitLines = refs(read(unitAssignment).Units).map(read);
    const lengthUnits = unitLines.filter((line) => text(line.UnitType) === "LENGTHUNIT");
    if (lengthUnits.length !== 1) throw new Error("IFC \u9879\u76EE\u957F\u5EA6\u5355\u4F4D\u7F3A\u5931\u6216\u4E0D\u552F\u4E00\u3002");
    const prefixes = {
      EXA: 1e18,
      PETA: 1e15,
      TERA: 1e12,
      GIGA: 1e9,
      MEGA: 1e6,
      KILO: 1e3,
      HECTO: 100,
      DECA: 10,
      "": 1,
      DECI: 0.1,
      CENTI: 0.01,
      MILLI: 1e-3,
      MICRO: 1e-6,
      NANO: 1e-9,
      PICO: 1e-12,
      FEMTO: 1e-15,
      ATTO: 1e-18
    };
    const lengthFactor = (line, visited = /* @__PURE__ */ new Set()) => {
      if (visited.has(line.expressID) || visited.size > 8) throw new Error("IFC \u957F\u5EA6\u5355\u4F4D\u8F6C\u6362\u5305\u542B\u5FAA\u73AF\u6216\u8FC7\u6DF1\u5F15\u7528\u3002");
      visited.add(line.expressID);
      if (typeName(line) === "IFCSIUNIT") {
        const factor = prefixes[text(line.Prefix)];
        if (text(line.Name) !== "METRE" || factor === void 0) throw new Error("\u5F53\u524D\u4E0D\u652F\u6301\u8BE5 IFC SI \u957F\u5EA6\u5355\u4F4D\u3002");
        return factor;
      }
      if (typeName(line) !== "IFCCONVERSIONBASEDUNIT") throw new Error("\u5F53\u524D\u4E0D\u652F\u6301\u8BE5 IFC \u957F\u5EA6\u5355\u4F4D\u8F6C\u6362\u3002");
      const conversionID = ref(line.ConversionFactor);
      if (!conversionID) throw new Error("IFC \u957F\u5EA6\u5355\u4F4D\u7F3A\u5C11\u8F6C\u6362\u7CFB\u6570\u3002");
      const conversion = read(conversionID), baseID = ref(conversion.UnitComponent), number = simple(conversion.ValueComponent);
      if (!baseID || typeof number !== "number" || !Number.isFinite(number) || number <= 0) throw new Error("IFC \u957F\u5EA6\u5355\u4F4D\u8F6C\u6362\u7CFB\u6570\u65E0\u6548\u3002");
      return number * lengthFactor(read(baseID), visited);
    };
    const metresPerUnit = lengthFactor(lengthUnits[0]);
    if (!Number.isFinite(metresPerUnit) || metresPerUnit < 1e-9 || metresPerUnit > 1e6) throw new Error("IFC \u957F\u5EA6\u5355\u4F4D\u5C3A\u5EA6\u8D85\u51FA\u652F\u6301\u8303\u56F4\u3002");
    const unitLabel = (unit) => [text(unit.Prefix), text(unit.Name) || typeName(unit)].filter(Boolean).join(" ");
    const projectUnits = Object.fromEntries(unitLines.map((unit) => [text(unit.UnitType), unitLabel(unit)]));
    const explicitUnit = (value, fallback) => {
      const id = ref(value);
      return id ? unitLabel(read(id)) : fallback ?? "\u672A\u58F0\u660E\u5355\u4F4D";
    };
    const productIDs = ids(IFCPRODUCT, true);
    if (!productIDs.length) throw new Error("IFC \u4E2D\u6CA1\u6709\u53EF\u8BFB\u53D6\u7684 IfcProduct \u5B9E\u4F53\u3002");
    if (productIDs.length > limits.products) failBudget("\u6784\u4EF6\u6570\u91CF");
    const components = [], componentMap = /* @__PURE__ */ new Map();
    progress("\u8BFB\u53D6 IFC \u6784\u4EF6\u4E0E\u6807\u8BC6", 0.12);
    for (let i = 0; i < productIDs.length; i++) {
      const id = productIDs[i], line = read(id), ifcType = api.GetNameFromTypeCode(line.type);
      const core = dict();
      for (const key of ["GlobalId", "Name", "Description", "ObjectType", "Tag", "PredefinedType"]) core[key] = scalar(line[key]);
      core.ExpressId = id;
      core.IfcType = ifcType;
      const component = {
        id: String(id),
        name: text(line.Name) || `${ifcType} #${id}`,
        category: ifcType,
        categoryCode: ifcType,
        family: "",
        type: "",
        matrix: identityMatrix,
        nodeIds: [],
        levelNames: [],
        properties: { IFC: core },
        typeProperties: dict(),
        familyProperties: dict()
      };
      components.push(component);
      componentMap.set(id, component);
      if (i % 1e3 === 0) progress("\u8BFB\u53D6 IFC \u6784\u4EF6\u4E0E\u6807\u8BC6", 0.12 + 0.1 * i / productIDs.length);
    }
    const merge = (target, source) => {
      for (const [group, values] of Object.entries(source)) {
        countValue(group);
        if (!target[group]) target[group] = values;
        else if (target[group] !== values) {
          for (const [key, value] of Object.entries(values)) {
            if (Object.hasOwn(target[group], key) && !Object.is(target[group][key], value))
              throw new Error(`IFC \u540C\u540D\u5C5E\u6027 ${group}.${key} \u5B58\u5728\u591A\u4E2A\u4E0D\u540C\u503C\uFF0C\u4E0D\u80FD\u65E0\u635F\u5408\u5E76\u3002`);
          }
          target[group] = { ...target[group], ...values };
        }
      }
    };
    const definitions = /* @__PURE__ */ new Map();
    const namedQuantities = /* @__PURE__ */ new Map();
    const definition = (id) => {
      const cached = definitions.get(id);
      if (cached) return cached;
      const line = read(id), kind = typeName(line), groups = dict(), values = dict(), units = dict();
      const group = text(line.Name) || `${kind} #${id}`;
      const property = (propertyID, depth = 0) => {
        if (depth > 12) throw new Error("IFC \u590D\u5408\u5C5E\u6027\u5D4C\u5957\u8D85\u8FC7\u652F\u6301\u6DF1\u5EA6\u3002");
        const p = read(propertyID), t = typeName(p), propertyName = text(p.Name) || `#${propertyID}`;
        countValue(propertyName);
        if (p.Unit != null) units[`${group}.${propertyName}`] = explicitUnit(p.Unit);
        if (t === "IFCPROPERTYSINGLEVALUE") return scalar(p.NominalValue);
        if (t === "IFCPROPERTYENUMERATEDVALUE") return scalar(p.EnumerationValues);
        if (t === "IFCPROPERTYLISTVALUE") return scalar(p.ListValues);
        if (t === "IFCPROPERTYBOUNDEDVALUE") return { lower: scalar(p.LowerBoundValue), upper: scalar(p.UpperBoundValue), setPoint: scalar(p.SetPointValue) };
        if (t === "IFCPROPERTYTABLEVALUE") return { defining: scalar(p.DefiningValues), defined: scalar(p.DefinedValues) };
        if (t === "IFCPROPERTYREFERENCEVALUE") return scalar(p.PropertyReference);
        if (t === "IFCCOMPLEXPROPERTY" || t === "IFCPHYSICALCOMPLEXQUANTITY") {
          const nested = dict();
          for (const child of refs(p.HasProperties ?? p.HasQuantities)) nested[text(read(child).Name) || `#${child}`] = property(child, depth + 1);
          return nested;
        }
        const quantityKeys = {
          IFCQUANTITYLENGTH: ["LengthValue", projectUnits.LENGTHUNIT],
          IFCQUANTITYAREA: ["AreaValue", projectUnits.AREAUNIT],
          IFCQUANTITYVOLUME: ["VolumeValue", projectUnits.VOLUMEUNIT],
          IFCQUANTITYCOUNT: ["CountValue", "count"],
          IFCQUANTITYWEIGHT: ["WeightValue", projectUnits.MASSUNIT],
          IFCQUANTITYTIME: ["TimeValue", projectUnits.TIMEUNIT]
        };
        const quantity = quantityKeys[t];
        if (quantity) {
          units[`${group}.${propertyName}`] = explicitUnit(p.Unit, quantity[1]);
          const value = scalar(p[quantity[0]]);
          const metric = namedMetricTypes[t];
          if (metric && depth === 0 && kind === "IFCELEMENTQUANTITY" && (/^Qto_\w+BaseQuantities$/i.test(group) || group === "BaseQuantities")) {
            const expected = namedQuantityUnits[metric];
            const unitId = ref(p.Unit);
            const matches = unitId ? [read(unitId)] : unitLines.filter((item) => text(item.UnitType) === expected[0]);
            const unit = matches.length === 1 ? matches[0] : void 0;
            const prefix = unit && text(unit.Prefix);
            const factor = unit && typeName(unit) === "IFCSIUNIT" && text(unit.Name) === expected[1] && text(unit.UnitType) === expected[0] ? !prefix ? 1 : metric === "length" ? prefixes[prefix] : void 0 : void 0;
            const normalized = typeof value === "number" && value >= 0 && factor !== void 0 ? value * factor : NaN;
            const status = factor === void 0 ? "unavailable" : Number.isFinite(normalized) ? "available" : "invalid";
            if (!namedQuantities.has(id)) namedQuantities.set(id, []);
            namedQuantities.get(id).push({ group, name: propertyName, metric, status, value: status === "available" ? normalized : null });
          }
          return value;
        }
        throw new Error(`\u5F53\u524D\u4E0D\u80FD\u53EF\u9760\u8BFB\u53D6\u5C5E\u6027\u5B9E\u4F53 ${t} #${propertyID}\uFF0C\u672A\u751F\u6210\u4E0D\u5B8C\u6574\u5BA1\u6838\u6A21\u578B\u3002`);
      };
      if (kind !== "IFCPROPERTYSET" && kind !== "IFCELEMENTQUANTITY") {
        unsupportedDefinitions++;
        warn2(`\u672A\u89E3\u6790\u5C5E\u6027\u5B9A\u4E49 ${kind} #${id}\uFF1B\u8BE5\u5B9A\u4E49\u4E0D\u5728\u672C\u6B21\u5C5E\u6027\u8986\u76D6\u8303\u56F4\u5185\u3002`);
        definitions.set(id, groups);
        return groups;
      }
      for (const propertyID of refs(line.HasProperties ?? line.Quantities)) {
        const key = text(read(propertyID).Name) || `#${propertyID}`;
        if (Object.hasOwn(values, key)) throw new Error(`IFC \u5C5E\u6027\u7EC4 ${group} \u4E2D\u5B58\u5728\u91CD\u590D\u540D\u79F0 ${key}\uFF0C\u4E0D\u80FD\u65E0\u635F\u5408\u5E76\u3002`);
        values[key] = property(propertyID);
      }
      groups[group] = values;
      if (Object.keys(units).length) groups["IFC source units"] = units;
      definitions.set(id, groups);
      return groups;
    };
    progress("\u8BFB\u53D6 IFC \u5C5E\u6027\u4E0E\u539F\u59CB\u6570\u91CF", 0.23);
    for (const id of ids(IFCRELDEFINESBYPROPERTIES)) {
      const relation = read(id);
      const propertyGroups = dict();
      const instanceQuantities = [];
      for (const definitionID of refs(relation.RelatingPropertyDefinition)) {
        merge(propertyGroups, definition(definitionID));
        for (const item of namedQuantities.get(definitionID) ?? []) instanceQuantities.push(item);
      }
      for (const target of refs(relation.RelatedObjects)) {
        const component = componentMap.get(target);
        if (component) {
          merge(component.properties, propertyGroups);
          if (instanceQuantities.length) component.ifcQuantities = (component.ifcQuantities ?? []).concat(instanceQuantities);
        }
      }
    }
    const types = /* @__PURE__ */ new Map(), typeGroups = /* @__PURE__ */ new Map();
    progress("\u8BFB\u53D6 IFC \u7C7B\u578B\u7EE7\u627F\u4E0E\u5206\u7C7B", 0.32);
    for (const id of ids(IFCRELDEFINESBYTYPE)) {
      const relation = read(id), typeID = ref(relation.RelatingType);
      if (!typeID) throw new Error(`IFC \u7C7B\u578B\u5173\u7CFB #${id} \u7F3A\u5C11\u76EE\u6807\u3002`);
      const type = read(typeID);
      let groups = typeGroups.get(typeID);
      if (!groups) {
        groups = { IFC: { ExpressId: typeID, IfcType: api.GetNameFromTypeCode(type.type), GlobalId: scalar(type.GlobalId), Name: scalar(type.Name) } };
        for (const definitionID of refs(type.HasPropertySets)) merge(groups, definition(definitionID));
        typeGroups.set(typeID, groups);
      }
      for (const target of refs(relation.RelatedObjects)) {
        const component = componentMap.get(target);
        if (!component) continue;
        if (types.has(target) && types.get(target) !== typeID) throw new Error(`IFC \u6784\u4EF6 #${target} \u88AB\u5173\u8054\u5230\u591A\u4E2A\u7C7B\u578B\u3002`);
        types.set(target, typeID);
        component.type = text(type.Name);
        component.typeProperties = groups;
      }
    }
    const classifications = /* @__PURE__ */ new Map();
    for (const id of ids(IFCRELASSOCIATESCLASSIFICATION)) {
      const relation = read(id), classID = ref(relation.RelatingClassification);
      if (!classID) throw new Error(`IFC \u5206\u7C7B\u5173\u7CFB #${id} \u7F3A\u5C11\u76EE\u6807\u3002`);
      const classification = read(classID);
      const code = text(classification.Identification ?? classification.ItemReference);
      let root = classification;
      const visited = /* @__PURE__ */ new Set();
      while (typeName(root) !== "IFCCLASSIFICATION") {
        if (visited.has(root.expressID) || visited.size > 32) throw new Error("IFC \u5206\u7C7B\u5F15\u7528\u5305\u542B\u5FAA\u73AF\u6216\u8FC7\u6DF1\u5F15\u7528\u3002");
        visited.add(root.expressID);
        const parent = ref(root.ReferencedSource);
        if (!parent) break;
        root = read(parent);
      }
      const system = typeName(root) === "IFCCLASSIFICATION" ? text(root.Name) : "";
      if (!system || !code) warn2(`\u5206\u7C7B\u5173\u7CFB #${id} \u7F3A\u5C11\u660E\u786E\u4F53\u7CFB\u6216\u7F16\u7801\uFF0C\u5DF2\u4FDD\u7559\u539F\u59CB\u5206\u7C7B\u4FE1\u606F\uFF0C\u4E0D\u80FD\u89C6\u4E3A\u5206\u7C7B\u901A\u8FC7\u3002`);
      for (const target of refs(relation.RelatedObjects)) {
        countValue(code);
        let values = classifications.get(target);
        if (!values) {
          values = dict();
          classifications.set(target, values);
        }
        const key = system || `\u672A\u58F0\u660E\u5206\u7C7B\u4F53\u7CFB #${root.expressID}`;
        const value = code || null;
        if (!(key in values)) values[key] = value;
        else if (values[key] !== value) values[key] = [...Array.isArray(values[key]) ? values[key] : [values[key]], value];
      }
    }
    for (const [id, values] of classifications) {
      const target = componentMap.get(id)?.properties ?? typeGroups.get(id);
      if (target) {
        if (target.Classification) throw new Error("IFC \u5C5E\u6027\u7EC4\u540D\u79F0 Classification \u4E0E\u5206\u7C7B\u5173\u7CFB\u51B2\u7A81\uFF0C\u4E0D\u80FD\u65E0\u635F\u5408\u5E76\u3002");
        target.Classification = values;
      }
    }
    progress("\u8BFB\u53D6 IFC \u7A7A\u95F4\u5C42\u7EA7", 0.4);
    const parents = /* @__PURE__ */ new Map();
    for (const relationType of [IFCRELCONTAINEDINSPATIALSTRUCTURE, IFCRELAGGREGATES, IFCRELNESTS]) {
      for (const id of ids(relationType)) {
        const relation = read(id), parent = ref(relation.RelatingStructure ?? relation.RelatingObject);
        if (!parent) throw new Error(`IFC \u7A7A\u95F4\u5173\u7CFB #${id} \u7F3A\u5C11\u7236\u5B9E\u4F53\u3002`);
        for (const child of refs(relation.RelatedElements ?? relation.RelatedObjects)) {
          countValue(child);
          if (!parents.has(child)) parents.set(child, /* @__PURE__ */ new Set());
          parents.get(child).add(parent);
        }
      }
    }
    const levels = ids(IFCBUILDINGSTOREY).map((id) => {
      const line = read(id), elevation = simple(line.Elevation);
      return {
        id,
        name: text(line.Name) || `IfcBuildingStorey #${id}`,
        elevation: typeof elevation === "number" && Number.isFinite(elevation) ? elevation * metresPerUnit : void 0,
        componentIds: []
      };
    });
    const levelMap = new Map(levels.map((level) => [level.id, level]));
    for (const [id, component] of componentMap) {
      const pending = [id], visited = /* @__PURE__ */ new Set();
      while (pending.length) {
        const at = pending.pop();
        if (visited.has(at)) continue;
        if (visited.size >= 256) throw new Error(`IFC \u6784\u4EF6 #${id} \u7A7A\u95F4\u7956\u5148\u8D85\u8FC7\u652F\u6301\u8303\u56F4\u3002`);
        visited.add(at);
        countValue(at);
        const level = levelMap.get(at);
        if (level) {
          if (!component.levelNames.includes(level.name)) component.levelNames.push(level.name);
          level.componentIds.push(component.id);
        } else pending.push(...parents.get(at) ?? []);
      }
    }
    const model = {
      name,
      units: { length: "m", source: `IFC placement coordinates; source length unit ${unitLabel(lengthUnits[0])}` },
      source: {
        format: "IFC",
        schema: declaredSchema,
        product: "web-ifc",
        exporterVersion: api.GetVersion(),
        modelName: name,
        coordinates: "IFC placement coordinates in metres, Z-up; no map/CRS conversion",
        matrixLayout: "column-major",
        lengthUnit: "m",
        scope: "IfcProduct records; IFC property sets, quantities, type inheritance, containment and classifications",
        sourceLengthUnit: unitLabel(lengthUnits[0]),
        metresPerSourceUnit: metresPerUnit
      },
      components,
      geometries: dict(),
      nodes: dict(),
      materials: dict(),
      textures: dict(),
      levels: levels.map(({ id: _id, ...level }) => level),
      warnings,
      stats: { components: components.length, geometries: 0, triangles: 0, nodes: 0 }
    };
    if (options.metadataOnly) return model;
    progress("\u751F\u6210 IFC \u51E0\u4F55", 0.47);
    api.StreamAllMeshes(mid, (mesh, index, total) => {
      const component = componentMap.get(mesh.expressID);
      if (!component) throw new Error(`IFC \u51E0\u4F55 #${mesh.expressID} \u6CA1\u6709\u5BF9\u5E94 IfcProduct \u8BB0\u5F55\u3002`);
      for (let i = 0; i < mesh.geometries.size(); i++) {
        if (++placementCount > limits.placements) failBudget("\u51E0\u4F55\u653E\u7F6E\u6570\u91CF");
        const placement = mesh.geometries.get(i), geometryID = String(placement.geometryExpressID);
        if (!model.geometries[geometryID]) {
          const geometry = api.GetGeometry(mid, placement.geometryExpressID);
          try {
            const vertexSize = geometry.GetVertexDataSize(), indexSize = geometry.GetIndexDataSize();
            if (!vertexSize || !indexSize) {
              warn2(`\u6784\u4EF6 #${mesh.expressID} \u7684\u51E0\u4F55 #${geometryID} \u6CA1\u6709\u4E09\u89D2\u9762\u3002`);
              continue;
            }
            if (vertexSize % 6 || indexSize % 3) throw new Error(`IFC \u51E0\u4F55 #${geometryID} \u7684\u7F13\u51B2\u5E03\u5C40\u65E0\u6548\u3002`);
            geometryBytes += vertexSize * 4 + indexSize * 4;
            triangles += indexSize / 3;
            if (geometryBytes > limits.geometryBytes) failBudget("\u51E0\u4F55\u5185\u5B58");
            if (triangles > limits.triangles) failBudget("\u552F\u4E00\u51E0\u4F55\u4E09\u89D2\u9762");
            const vertices = api.GetVertexArray(geometry.GetVertexData(), vertexSize);
            const count = vertexSize / 6, positions = floats(count * 3), normals = floats(count * 3);
            for (let v = 0; v < count; v++) {
              for (let axis = 0; axis < 3; axis++) {
                const position = vertices[v * 6 + axis], normal = vertices[v * 6 + axis + 3];
                if (!Number.isFinite(position) || !Number.isFinite(normal)) throw new Error("IFC \u51E0\u4F55\u5305\u542B\u975E\u6709\u9650\u5750\u6807\u3002");
                positions[v * 3 + axis] = position;
                normals[v * 3 + axis] = normal;
              }
            }
            const indices = integers(indexSize);
            indices.set(api.GetIndexArray(geometry.GetIndexData(), indexSize));
            if (indices.some((vertex) => vertex >= count)) throw new Error("IFC \u51E0\u4F55\u7D22\u5F15\u8D85\u51FA\u9876\u70B9\u8303\u56F4\u3002");
            model.geometries[geometryID] = { id: geometryID, positions, normals, indices };
          } finally {
            geometry.delete();
          }
        }
        const color = placement.color, colorValues = [color.x, color.y, color.z, color.w];
        if (!colorValues.every(Number.isFinite)) throw new Error("IFC \u6750\u8D28\u5305\u542B\u65E0\u6548\u989C\u8272\u3002");
        const materialID = colorValues.join(",");
        model.materials[materialID] ??= { id: materialID, raw: { color: colorValues.slice(0, 3), opacity: color.w } };
        const nodeID = `${component.id}:${i}`;
        if (model.nodes[nodeID]) throw new Error("IFC \u51E0\u4F55\u653E\u7F6E\u7F16\u53F7\u91CD\u590D\u3002");
        const matrix2 = placement.flatTransformation;
        if (matrix2.length !== 16 || !matrix2.every(Number.isFinite)) throw new Error("IFC \u51E0\u4F55\u53D8\u6362\u77E9\u9635\u65E0\u6548\u3002");
        const nodeMatrix = matrices(16);
        nodeMatrix.set(matrix2);
        model.nodes[nodeID] = { id: nodeID, geometryId: geometryID, materialId: materialID, matrix: nodeMatrix };
        component.nodeIds.push(nodeID);
      }
      if (index % 100 === 0) progress("\u751F\u6210 IFC \u51E0\u4F55", 0.47 + 0.4 * (index + 1) / Math.max(1, total));
    }, true);
    progress("\u6062\u590D IFC \u5750\u6807\u5E76\u6838\u5BF9\u6A21\u578B", 0.9);
    const coordinationValues = api.GetCoordinationMatrix(mid);
    if (coordinationValues.length !== 16 || !coordinationValues.every(Number.isFinite)) throw new Error("IFC \u534F\u8C03\u77E9\u9635\u65E0\u6548\u3002");
    const coordination = new Matrix4().fromArray(coordinationValues);
    if (Math.abs(coordination.determinant()) < 1e-12) throw new Error("IFC \u534F\u8C03\u77E9\u9635\u4E0D\u53EF\u9006\u3002");
    const restore = Y_TO_Z.clone().multiply(coordination.invert());
    const matrix = new Matrix4();
    let placedTriangles = 0;
    for (const node of Object.values(model.nodes)) {
      matrix.fromArray(node.matrix).premultiply(restore);
      if (!matrix.elements.every(Number.isFinite)) throw new Error("IFC \u8FD8\u539F\u5750\u6807\u5305\u542B\u975E\u6709\u9650\u6570\u5B57\u3002");
      node.matrix.set(matrix.elements);
      placedTriangles += model.geometries[node.geometryId].indices.length / 3;
      if (placedTriangles > limits.triangles) failBudget("\u653E\u7F6E\u540E\u4E09\u89D2\u9762");
    }
    const withGeometry = components.filter((c) => c.nodeIds.length).length;
    if (withGeometry < components.length) warn2(`${components.length - withGeometry} \u4E2A IfcProduct \u8BB0\u5F55\u6CA1\u6709\u5DF2\u751F\u6210\u7684\u51E0\u4F55\uFF0C\u5DF2\u4FDD\u7559\u5C5E\u6027\u7528\u4E8E\u5BA1\u6838\uFF1B\u4E0D\u4EE3\u8868\u51E0\u4F55\u5B8C\u6574\u3002`);
    if (warningCount > warnings.length) warnings.push(`\u5171 ${warningCount} \u9879\u5BFC\u5165\u63D0\u793A\uFF0C\u4EC5\u5217\u51FA\u524D ${warnings.length} \u9879\uFF1B\u8986\u76D6\u7EDF\u8BA1\u89C1 IFC \u5BFC\u5165\u5143\u6570\u636E\u3002`);
    model.metadata = { "ifc-import.json": {
      schema: declaredSchema,
      engine: `web-ifc ${api.GetVersion()}`,
      products: components.length,
      productsWithGeometry: withGeometry,
      uniqueGeometryTriangles: triangles,
      placedTriangles,
      coordinationMatrix: coordinationValues,
      sourceUnits: projectUnits,
      quantities: "Original IFC values, units in IFC source units groups; not Revit quantity snapshots",
      propertyCoverage: unsupportedDefinitions ? "partial-see-warnings" : "supported-property-sets-and-quantities",
      unsupportedPropertyDefinitions: unsupportedDefinitions,
      warningCount,
      scope: "IFC2X3/IFC4 common products; not full IFC validation; no geographic CRS/map conversion"
    } };
    model.stats = {
      components: components.length,
      nodes: Object.keys(model.nodes).length,
      geometries: Object.keys(model.geometries).length,
      triangles
    };
    progress("IFC \u6A21\u578B\u8BFB\u53D6\u5B8C\u6210", 1);
    return model;
  } catch (error) {
    throw new Error(`IFC \u5BFC\u5165\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
  } finally {
    try {
      if (modelID !== void 0) api.CloseModel(modelID);
    } finally {
      if (api.wasmModule) api.Dispose();
    }
  }
}
export {
  parseIfc
};
