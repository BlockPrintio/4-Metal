// ─── Manual CBOR Decoder (Standalone) ──────────────────────────────────────
// This decoder handles Charli3 OracleAgg datums including indefinite length
// maps and arrays that standard JSON-deserializers often struggle with.
// ────────────────────────────────────────────────────────────────────────────

type CV = number | string | bigint | CV[] | [CV, CV][] | { tag: number; val: CV };

export function cborDecode(b: Buffer, i: number): [CV, number] {
  const byte = b[i], major = byte >> 5, add = byte & 0x1f;
  i++;

  if (add === 31) { // Indefinite length
    if (major === 2) { // Byte string chunks
      let chunks = Buffer.alloc(0);
      while (b[i] !== 0xff) {
        const [v, ni] = cborDecode(b, i);
        chunks = Buffer.concat([chunks, Buffer.from(v as string, "hex")]);
        i = ni;
      }
      return [chunks.toString("hex"), i + 1];
    }
    if (major === 4) { // Array
      const arr: CV[] = [];
      while (b[i] !== 0xff) {
        const [v, ni] = cborDecode(b, i);
        arr.push(v);
        i = ni;
      }
      return [arr, i + 1];
    }
    if (major === 5) { // Map
      const pairs: [CV, CV][] = [];
      while (b[i] !== 0xff) {
        const [key, ni] = cborDecode(b, i); i = ni;
        const [val, ni2] = cborDecode(b, i); i = ni2;
        pairs.push([key, val]);
      }
      return [pairs, i + 1];
    }
    throw new Error(`unsupported indefinite major ${major}`);
  }

  let n: bigint | number;
  if      (add < 24)   n = add;
  else if (add === 24) n = b[i++];
  else if (add === 25) { n = b.readUInt16BE(i);          i += 2; }
  else if (add === 26) { n = b.readUInt32BE(i);          i += 4; }
  else if (add === 27) { n = b.readBigUInt64BE(i);       i += 8; }
  else throw new Error(`unsupported cbor add ${add}`);

  if (major === 0) return [typeof n === "bigint" ? n : BigInt(n), i]; // integer
  if (major === 2) { // byte string
    const num = Number(n);
    const s = b.subarray(i, i + num).toString("hex");
    return [s, i + num];
  }
  if (major === 4) { // array
    const num = Number(n);
    const arr: CV[] = [];
    for (let k = 0; k < num; k++) { const [v, ni] = cborDecode(b, i); arr.push(v); i = ni; }
    return [arr, i];
  }
  if (major === 5) { // map
    const num = Number(n);
    const pairs: [CV, CV][] = [];
    for (let k = 0; k < num; k++) {
      const [key, ni] = cborDecode(b, i); i = ni;
      const [val, ni2] = cborDecode(b, i); i = ni2;
      pairs.push([key, val]);
    }
    return [pairs, i];
  }
  if (major === 6) { // tag/constr
    const [val, ni] = cborDecode(b, i);
    return [{ tag: Number(n), val }, ni];
  }
  throw new Error(`unsupported major ${major}`);
}
