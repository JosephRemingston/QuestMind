// Small ZIP fixture builder: stored entries, including CRC and central directory.
const crc32 = buffer => { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
export function zip(entries, options = {}) {
  const local = [], directory = []; let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const filename = Buffer.from(name), data = Buffer.from(text), crc = crc32(data), header = Buffer.alloc(30), central = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(options.flags ?? 0, 6); header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(options.expandedSize ?? data.length, 22); header.writeUInt16LE(filename.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(options.flags ?? 0, 8); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(options.expandedSize ?? data.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    local.push(header, filename, data); directory.push(central, filename); offset += header.length + filename.length + data.length;
  }
  const footer = Buffer.alloc(22), central = Buffer.concat(directory);
  footer.writeUInt32LE(0x06054b50); footer.writeUInt16LE(directory.length / 2, 8); footer.writeUInt16LE(directory.length / 2, 10); footer.writeUInt32LE(central.length, 12); footer.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, central, footer]);
}
export const epubEntries = {
  mimetype: 'application/epub+zip',
  'META-INF/container.xml': '<container><rootfiles><rootfile full-path="book/package.opf"/></rootfiles></container>',
  'book/package.opf': '<package><manifest><item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch1"/></spine></package>',
  'book/chapter1.xhtml': '<html><head><title>Metadata</title></head><body><h1>Triangles</h1><p>A triangle has three sides.</p><script>Do not extract this script</script></body></html>',
};
