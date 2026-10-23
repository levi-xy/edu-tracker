import fs from 'node:fs';

// ISO-BMFF (mp4, m4v, mov): walk top-level boxes for moov > mvhd, which holds
// a timescale and a duration in that timescale.
function isoDuration(fd, size) {
  const readBox = (start, end) => {
    let pos = start;
    while (pos + 8 <= end) {
      const header = Buffer.alloc(8);
      fs.readSync(fd, header, 0, 8, pos);
      let boxSize = header.readUInt32BE(0);
      const type = header.toString('latin1', 4, 8);
      let headerLen = 8;
      if (boxSize === 1) {
        const ext = Buffer.alloc(8);
        fs.readSync(fd, ext, 0, 8, pos + 8);
        boxSize = Number(ext.readBigUInt64BE(0));
        headerLen = 16;
      } else if (boxSize === 0) {
        boxSize = end - pos;
      }
      if (boxSize < headerLen || pos + boxSize > end) return null;
      if (type === 'moov') return readMvhd(pos + headerLen, pos + boxSize);
      pos += boxSize;
    }
    return null;
  };
  const readMvhd = (start, end) => {
    let pos = start;
    while (pos + 8 <= end) {
      const header = Buffer.alloc(8);
      fs.readSync(fd, header, 0, 8, pos);
      const boxSize = header.readUInt32BE(0);
      const type = header.toString('latin1', 4, 8);
      if (boxSize < 8 || pos + boxSize > end) return null;
      if (type === 'mvhd') {
        const body = Buffer.alloc(boxSize - 8);
        fs.readSync(fd, body, 0, body.length, pos + 8);
        const version = body[0];
        const timescale = version === 1 ? body.readUInt32BE(20) : body.readUInt32BE(12);
        const duration = version === 1 ? Number(body.readBigUInt64BE(24)) : body.readUInt32BE(16);
        return timescale ? duration / timescale : null;
      }
      pos += boxSize;
    }
    return null;
  };
  return readBox(0, size);
}

// WebM/Matroska (EBML): walk Segment > Info for Duration (float) and
// TimecodeScale (uint ns per tick, default 1e6).
function webmDuration(fd, size) {
  const vint = (buf, pos, keepMarker) => {
    const first = buf[pos];
    if (first === undefined) return null;
    let len = 1;
    for (let mask = 0x80; mask > 0 && !(first & mask); mask >>= 1) len++;
    if (len > 8 || pos + len > buf.length) return null;
    let value = keepMarker ? first : first & (0xff >> len);
    for (let i = 1; i < len; i++) value = value * 256 + buf[pos + i];
    return { value, len };
  };
  const readUint = (buf) => {
    let v = 0;
    for (const b of buf) v = v * 256 + b;
    return v;
  };
  const readFloat = (buf) => (buf.length === 4 ? buf.readFloatBE(0) : buf.readDoubleBE(0));
  // Element IDs we care about (kept with their length marker, as EBML convention).
  const SEGMENT = 0x18538067, INFO = 0x1549a966, DURATION = 0x4489, TIMECODE_SCALE = 0x2ad7b1;

  const walk = (start, end, targetId, chunkSize) => {
    const buf = Buffer.alloc(Math.min(chunkSize, end - start));
    fs.readSync(fd, buf, 0, buf.length, start);
    let pos = 0;
    while (pos < buf.length) {
      const id = vint(buf, pos, true);
      if (!id) break;
      const sz = vint(buf, pos + id.len, false);
      if (!sz) break;
      const bodyStart = start + pos + id.len + sz.len;
      if (id.value === targetId) return { start: bodyStart, size: sz.value };
      pos += id.len + sz.len + sz.value;
    }
    return null;
  };

  const segment = walk(0, size, SEGMENT, Math.min(size, 1 << 20));
  if (!segment) return null;
  const info = walk(segment.start, segment.start + segment.size, INFO, Math.min(segment.size, 1 << 20));
  if (!info) return null;
  const infoBuf = Buffer.alloc(Math.min(info.size, 1 << 16));
  fs.readSync(fd, infoBuf, 0, infoBuf.length, info.start);
  let pos = 0, duration = null, timecodeScale = 1e6;
  while (pos < infoBuf.length) {
    const id = vint(infoBuf, pos, true);
    if (!id) break;
    const sz = vint(infoBuf, pos + id.len, false);
    if (!sz) break;
    const bodyStart = pos + id.len + sz.len;
    const body = infoBuf.subarray(bodyStart, bodyStart + sz.value);
    if (id.value === DURATION && body.length) duration = readFloat(body);
    if (id.value === TIMECODE_SCALE && body.length) timecodeScale = readUint(body);
    pos = bodyStart + sz.value;
  }
  return duration != null ? (duration * timecodeScale) / 1e9 : null;
}

// Returns the video's length in whole minutes (minimum 1), or null if the
// file can't be parsed (unsupported variant, corrupt header, etc).
export function videoDurationMinutes(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const size = fs.fstatSync(fd).size;
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    const seconds = ext === '.webm' ? webmDuration(fd, size) : isoDuration(fd, size);
    return seconds && seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
