const test = require('brittle')
const c = require('compact-encoding')
const path = require('path')

const { createTestSchema } = require('./')

const fixtureDir = path.resolve(__dirname, 'fixtures')
// ─────────────────────────────────────────────────────────────────────────────
// 1. Required uint field + optional string field (basic struct)
// ─────────────────────────────────────────────────────────────────────────────
test('required uint and optional string', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '1')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns1')
    ns.register({
      name: 'item',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'label', type: 'string' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns1/item')

  const cases = [
    { id: 0, label: null },
    { id: 1, label: 'hello' },
    { id: 255, label: '' },
    { id: 1000, label: 'foo bar' },
    { id: 99999, label: null },
    { id: 1, label: 'x' },
    { id: 2 ** 32, label: 'big' },
    { id: 7, label: 'seven' },
    { id: 42, label: null },
    { id: 123456789, label: 'large id' }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Versioned struct – append-only extension
// ─────────────────────────────────────────────────────────────────────────────
test.skip('versioned struct – v1 and v2 encodings', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '2')

  // v1
  await schema.rebuild((s) => {
    const ns = s.namespace('ns2')
    ns.register({
      name: 'user',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'name', type: 'string' }
      ]
    })
  })

  // v2 – adds optional 'email' field
  await schema.rebuild((s) => {
    const ns = s.namespace('ns2')
    ns.register({
      name: 'user',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' }
      ]
    })
  })

  const enc1 = schema.module.resolveStruct('@ns2/user', 1)
  const enc2 = schema.module.resolveStruct('@ns2/user', 2)

  // v1 encoder strips 'email'; v2 preserves it
  const objects = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: null },
    { id: 3, name: null, email: 'c@d.com' },
    { id: 10, name: 'Charlie', email: 'charlie@test.io' },
    { id: 0, name: '', email: '' },
    { id: 99, name: 'Dave', email: 'dave@x.com' },
    { id: 5, name: 'Eve', email: null },
    { id: 7, name: 'Frank', email: 'frank@f.net' },
    { id: 8, name: 'Grace', email: 'g@h.org' },
    { id: 9, name: 'Hank', email: null }
  ]

  for (const obj of objects) {
    // v1 round-trip drops email
    const v1 = c.decode(enc1, c.encode(enc1, obj))
    t.alike(v1, { id: obj.id, name: obj.name, email: null })

    // v2 round-trip keeps email
    const v2 = c.decode(enc2, c.encode(enc2, obj))
    t.alike(v2, obj)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Compact struct (cannot be extended)
// ─────────────────────────────────────────────────────────────────────────────
test('compact struct round-trip', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '3')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns3')
    ns.register({
      name: 'point',
      compact: true,
      fields: [
        { name: 'x', type: 'int', required: true },
        { name: 'y', type: 'int', required: true }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns3/point')

  const cases = [
    { x: 0, y: 0 },
    { x: 1, y: -1 },
    { x: 100, y: 200 },
    { x: -50, y: 50 },
    { x: 32767, y: -32768 },
    { x: -1, y: -1 },
    { x: 999, y: 1 },
    { x: 0, y: -9999 },
    { x: 12345, y: 67890 },
    { x: -100, y: -200 }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Struct with bool and float64 fields
// ─────────────────────────────────────────────────────────────────────────────
test('bool and float64 fields', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '4')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns4')
    ns.register({
      name: 'measurement',
      fields: [
        { name: 'active', type: 'bool', required: true },
        { name: 'value', type: 'float64', required: true }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns4/measurement')

  const cases = [
    { active: true, value: 0.0 },
    { active: false, value: 1.0 },
    { active: true, value: -1.0 },
    { active: false, value: 3.14159265358979 },
    { active: true, value: 1e100 },
    { active: false, value: -1e-100 },
    { active: true, value: Number.MAX_SAFE_INTEGER },
    { active: false, value: Number.MIN_SAFE_INTEGER },
    { active: true, value: 0.1 + 0.2 },
    { active: false, value: 42.0 }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Struct with buffer field
// ─────────────────────────────────────────────────────────────────────────────
test('buffer field encoding', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '5')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns5')
    ns.register({
      name: 'blob',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'data', type: 'buffer' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns5/blob')

  const cases = [
    { id: 1, data: Buffer.from('hello') },
    { id: 2, data: Buffer.from([0x00, 0x01, 0x02]) },
    { id: 3, data: null },
    { id: 4, data: Buffer.alloc(0) },
    { id: 5, data: Buffer.from('binary\x00\xFF') },
    { id: 6, data: Buffer.from('unicode 🎉', 'utf8') },
    { id: 7, data: Buffer.alloc(64, 0xab) },
    { id: 8, data: Buffer.from('short') },
    { id: 9, data: Buffer.from([255, 254, 253]) },
    { id: 10, data: null }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Array of a primitive alias
// ─────────────────────────────────────────────────────────────────────────────
test('array of uint alias', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '6')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns6')
    ns.register({ name: 'score', alias: 'uint' }) // alias
    ns.register({ name: 'scores', type: '@ns6/score', array: true })
  })

  const enc = schema.module.resolveStruct('@ns6/scores')

  const cases = [
    [],
    [0],
    [1, 2, 3],
    [100, 200, 300, 400],
    [0, 0, 0],
    [1],
    [255, 256, 257],
    [10, 20, 30, 40, 50],
    [99999],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Array of structs
// ─────────────────────────────────────────────────────────────────────────────
test('array of structs', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '7')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns7')
    ns.register({
      name: 'entry',
      compact: true,
      fields: [
        { name: 'key', type: 'string', required: true },
        { name: 'value', type: 'uint', required: true }
      ]
    })
    ns.register({ name: 'entries', type: '@ns7/entry', array: true })
  })

  const enc = schema.module.resolveStruct('@ns7/entries')

  const cases = [
    [],
    [{ key: 'a', value: 1 }],
    [
      { key: 'x', value: 0 },
      { key: 'y', value: 255 }
    ],
    [
      { key: 'foo', value: 100 },
      { key: 'bar', value: 200 },
      { key: 'baz', value: 300 }
    ],
    [{ key: '', value: 0 }],
    [{ key: 'hello world', value: 42 }],
    [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
      { key: 'd', value: 4 }
    ],
    [{ key: 'unicode 🎉', value: 7 }],
    [{ key: 'z', value: 99999 }],
    [
      { key: 'k1', value: 1 },
      { key: 'k2', value: 2 }
    ]
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Nested struct (struct field referencing another struct)
// ─────────────────────────────────────────────────────────────────────────────
test('nested struct reference', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '8')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns8')
    ns.register({
      name: 'address',
      fields: [
        { name: 'street', type: 'string' },
        { name: 'city', type: 'string' }
      ]
    })
    ns.register({
      name: 'person',
      fields: [
        { name: 'name', type: 'string', required: true },
        { name: 'address', type: '@ns8/address' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns8/person')

  const cases = [
    { name: 'Alice', address: { street: '1 Main St', city: 'Springfield' } },
    { name: 'Bob', address: null },
    { name: 'Charlie', address: { street: null, city: 'Shelbyville' } },
    { name: 'Diana', address: { street: '5th Ave', city: null } },
    { name: 'Eve', address: { street: null, city: null } },
    { name: 'Frank', address: { street: '42 Galaxy Way', city: 'Cosmos' } },
    { name: 'Grace', address: { street: '', city: '' } },
    { name: 'Hank', address: null },
    { name: 'Iris', address: { street: 'A', city: 'B' } },
    { name: 'Jack', address: { street: 'Long Street Name Here', city: 'Townsville' } }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. Alias for a built-in type
// ─────────────────────────────────────────────────────────────────────────────
test('alias for built-in type (string)', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '9')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns9')
    ns.register({ name: 'tag', alias: 'string' })
    ns.register({
      name: 'tagged',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'tag', type: '@ns9/tag' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns9/tagged')

  const cases = [
    { id: 1, tag: 'alpha' },
    { id: 2, tag: null },
    { id: 3, tag: '' },
    { id: 4, tag: 'hello world' },
    { id: 5, tag: 'tag-with-dashes' },
    { id: 6, tag: '日本語' },
    { id: 7, tag: '🎉' },
    { id: 8, tag: null },
    { id: 9, tag: 'UPPERCASE' },
    { id: 10, tag: 'mixed 123 !@#' }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. Cross-namespace struct reference
// ─────────────────────────────────────────────────────────────────────────────
test('cross-namespace struct reference', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '10')

  await schema.rebuild((s) => {
    const common = s.namespace('common')
    common.register({
      name: 'timestamp',
      compact: true,
      fields: [
        { name: 'sec', type: 'uint', required: true },
        { name: 'nsec', type: 'uint', required: true }
      ]
    })

    const events = s.namespace('events')
    events.register({
      name: 'event',
      fields: [
        { name: 'type', type: 'string', required: true },
        { name: 'payload', type: 'string' },
        { name: 'ts', type: '@common/timestamp' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@events/event')

  const cases = [
    { type: 'click', payload: 'button-1', ts: { sec: 1700000000, nsec: 0 } },
    { type: 'submit', payload: null, ts: { sec: 0, nsec: 500000000 } },
    { type: 'load', payload: '/page', ts: null },
    { type: 'error', payload: 'oops', ts: { sec: 9999, nsec: 999999 } },
    { type: 'open', payload: null, ts: { sec: 1, nsec: 1 } },
    { type: 'close', payload: 'tab-2', ts: null },
    { type: 'resize', payload: '1024x768', ts: { sec: 100, nsec: 0 } },
    { type: 'scroll', payload: null, ts: { sec: 200, nsec: 0 } },
    { type: 'focus', payload: 'input#1', ts: { sec: 300, nsec: 0 } },
    { type: 'blur', payload: null, ts: null }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 11. flagsPosition override
// ─────────────────────────────────────────────────────────────────────────────
test('flagsPosition override', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '11')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns11')
    ns.register({
      name: 'flagged',
      flagsPosition: 0, // flags byte at position 0
      fields: [
        { name: 'a', type: 'string' },
        { name: 'b', type: 'string' },
        { name: 'c', type: 'uint' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns11/flagged')

  const cases = [
    { a: null, b: null, c: null },
    { a: 'hello', b: null, c: null },
    { a: null, b: 'world', c: null },
    { a: null, b: null, c: 42 },
    { a: 'foo', b: 'bar', c: 7 },
    { a: '', b: '', c: 0 },
    { a: 'x', b: null, c: 1 },
    { a: null, b: 'y', c: 2 },
    { a: 'aaa', b: 'bbb', c: null },
    { a: 'z', b: 'z', c: 99 }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 12. Inline compact struct field
// ─────────────────────────────────────────────────────────────────────────────
test('inline compact struct field', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '12')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns12')
    ns.register({
      name: 'meta',
      compact: true,
      fields: [
        { name: 'version', type: 'uint', required: true },
        { name: 'flags', type: 'uint', required: true }
      ]
    })
    ns.register({
      name: 'packet',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'meta', type: '@ns12/meta', inline: true },
        { name: 'body', type: 'string' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns12/packet')

  const cases = [
    { id: 1, meta: { version: 1, flags: 0 }, body: 'ping' },
    { id: 2, meta: { version: 2, flags: 1 }, body: null },
    { id: 3, meta: { version: 1, flags: 3 }, body: 'data' },
    { id: 4, meta: null, body: 'no meta' },
    { id: 5, meta: { version: 10, flags: 255 }, body: null },
    { id: 6, meta: null, body: null },
    { id: 7, meta: { version: 0, flags: 0 }, body: '' },
    { id: 8, meta: { version: 99, flags: 1 }, body: 'pong' },
    { id: 9, meta: null, body: 'x' },
    { id: 10, meta: { version: 5, flags: 5 }, body: 'hello' }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 13. uint8, uint16, uint32 field types
// ─────────────────────────────────────────────────────────────────────────────
test('fixed-width uint8/uint16/uint32 fields', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '13')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns13')
    ns.register({
      name: 'widths',
      fields: [
        { name: 'a', type: 'uint8', required: true },
        { name: 'b', type: 'uint16', required: true },
        { name: 'c', type: 'uint32', required: true }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns13/widths')

  const cases = [
    { a: 0, b: 0, c: 0 },
    { a: 255, b: 65535, c: 4294967295 },
    { a: 1, b: 256, c: 65536 },
    { a: 127, b: 32767, c: 2147483647 },
    { a: 128, b: 32768, c: 2147483648 },
    { a: 10, b: 1000, c: 100000 },
    { a: 200, b: 50000, c: 1000000 },
    { a: 0, b: 1, c: 1 },
    { a: 99, b: 9999, c: 999999 },
    { a: 42, b: 4242, c: 424242 }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 14. int (signed, ZigZag) field type
// ─────────────────────────────────────────────────────────────────────────────
test('signed int field (ZigZag encoding)', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '14')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns14')
    ns.register({
      name: 'delta',
      fields: [
        { name: 'dx', type: 'int', required: true },
        { name: 'dy', type: 'int', required: true },
        { name: 'dz', type: 'int' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns14/delta')

  const cases = [
    { dx: 0, dy: 0, dz: null },
    { dx: 1, dy: -1, dz: 0 },
    { dx: -100, dy: 100, dz: null },
    { dx: 32767, dy: -32767, dz: 1 },
    { dx: -1, dy: -1, dz: -1 },
    { dx: 1000, dy: 2000, dz: 3000 },
    { dx: 0, dy: -9999, dz: null },
    { dx: -500, dy: 500, dz: -500 },
    { dx: 9, dy: -9, dz: 9 },
    { dx: 12345, dy: -12345, dz: null }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 15. float32 and float64 fields
// ─────────────────────────────────────────────────────────────────────────────
test('float32 and float64 fields', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '15')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns15')
    ns.register({
      name: 'floats',
      fields: [
        { name: 'f32', type: 'float32', required: true },
        { name: 'f64', type: 'float64', required: true }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns15/floats')

  const cases = [
    { f32: 0.0, f64: 0.0 },
    { f32: 1.0, f64: 1.0 },
    { f32: -1.0, f64: -1.0 },
    { f32: 3.14, f64: Math.PI },
    { f32: 1e10, f64: 1e100 },
    { f32: -3.14, f64: -Math.E },
    { f32: 0.5, f64: 0.5 },
    { f32: 100.0, f64: 100.0 },
    { f32: -100.0, f64: -100.0 },
    { f32: 1.5, f64: 1.5 }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 16. useDefault: false field
// ─────────────────────────────────────────────────────────────────────────────
test('useDefault false – undefined vs null', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '16')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns16')
    ns.register({
      name: 'sparse',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'score', type: 'uint', useDefault: false },
        { name: 'tag', type: 'string', useDefault: false }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns16/sparse')

  const cases = [
    { id: 1, score: 100, tag: 'a' },
    { id: 2, score: null, tag: null },
    { id: 3, score: 0, tag: null },
    { id: 4, score: null, tag: 'b' },
    { id: 5, score: 50, tag: null },
    { id: 6, score: null, tag: '' },
    { id: 7, score: 7, tag: 'seven' },
    { id: 8, score: null, tag: null },
    { id: 9, score: 255, tag: 'max' },
    { id: 10, score: null, tag: null }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 17. DELETED - hallucination
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 18. Multiple optional fields – flag byte usage
// ─────────────────────────────────────────────────────────────────────────────
test('multiple optional fields and flag byte combinations', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '18')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns18')
    ns.register({
      name: 'rich',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'name', type: 'string' },
        { name: 'age', type: 'uint' },
        { name: 'active', type: 'bool' },
        { name: 'score', type: 'float64' },
        { name: 'bio', type: 'string' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns18/rich')

  const cases = [
    { id: 1, name: null, age: null, active: null, score: null, bio: null },
    { id: 2, name: 'Alice', age: null, active: null, score: null, bio: null },
    { id: 3, name: null, age: 30, active: null, score: null, bio: null },
    { id: 4, name: null, age: null, active: true, score: null, bio: null },
    { id: 5, name: null, age: null, active: null, score: 9.5, bio: null },
    { id: 6, name: null, age: null, active: null, score: null, bio: 'Hi' },
    { id: 7, name: 'Bob', age: 25, active: true, score: 8.0, bio: 'Dev' },
    { id: 8, name: 'Carol', age: null, active: false, score: null, bio: null },
    { id: 9, name: null, age: 0, active: false, score: 0.0, bio: '' },
    { id: 10, name: 'Dave', age: 40, active: null, score: 7.777, bio: null }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 19. Three-version evolution (v1 → v2 → v3)
// ─────────────────────────────────────────────────────────────────────────────
test.skip('three-version schema evolution', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '19')

  // v1
  await schema.rebuild((s) => {
    s.namespace('ns19').register({
      name: 'doc',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'title', type: 'string' }
      ]
    })
  })

  // v2 – adds 'body'
  await schema.rebuild((s) => {
    s.namespace('ns19').register({
      name: 'doc',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'title', type: 'string' },
        { name: 'body', type: 'string' }
      ]
    })
  })

  // v3 – adds 'tags' array (alias first)
  await schema.rebuild((s) => {
    const ns = s.namespace('ns19')
    ns.register({ name: 'tag', alias: 'string' })
    ns.register({
      name: 'doc',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'title', type: 'string' },
        { name: 'body', type: 'string' },
        { name: 'tags', type: '@ns19/tag', array: true }
      ]
    })
  })

  const enc1 = schema.module.resolveStruct('@ns19/doc', 1)
  const enc2 = schema.module.resolveStruct('@ns19/doc', 2)
  const enc3 = schema.module.resolveStruct('@ns19/doc', 3)

  const objects = [
    { id: 1, title: 'Hello', body: 'World', tags: ['a', 'b'] },
    { id: 2, title: null, body: 'content', tags: [] },
    { id: 3, title: 'No body', body: null, tags: null },
    { id: 4, title: 'Tagged', body: 'stuff', tags: ['x'] },
    { id: 5, title: null, body: null, tags: null },
    { id: 6, title: 'A', body: 'B', tags: ['c', 'd', 'e'] },
    { id: 7, title: 'Seven', body: null, tags: [] },
    { id: 8, title: null, body: 'eight', tags: ['f'] },
    { id: 9, title: 'Nine', body: 'nine', tags: null },
    { id: 10, title: 'Ten', body: 'ten', tags: ['g', 'h', 'i', 'j'] }
  ]

  for (const obj of objects) {
    const v1 = c.decode(enc1, c.encode(enc1, obj))
    t.alike(v1, { id: obj.id, title: obj.title, body: null, tags: null })

    const v2 = c.decode(enc2, c.encode(enc2, obj))
    t.alike(v2, { id: obj.id, title: obj.title, body: obj.body, tags: null })

    const v3 = c.decode(enc3, c.encode(enc3, obj))
    t.alike(v3, obj)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 20. Complex struct: all field options combined
// ─────────────────────────────────────────────────────────────────────────────
test('complex struct – required, optional, array, record, nested, inline', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '20')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns20')

    ns.register({
      name: 'coord',
      compact: true,
      fields: [
        { name: 'lat', type: 'float64', required: true },
        { name: 'lng', type: 'float64', required: true }
      ]
    })

    ns.register({ name: 'label', alias: 'string' })

    ns.register({
      name: 'meta',
      alias: 'uint'
    })

    ns.register({
      name: 'place',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'coord', type: '@ns20/coord', inline: true },
        { name: 'labels', type: '@ns20/label', array: true },
        { name: 'meta', type: '@ns20/meta' },
        { name: 'rank', type: 'uint' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns20/place')

  const cases = [
    {
      id: 1,
      name: 'Origin',
      coord: { lat: 0.0, lng: 0.0 },
      labels: []
    },
    {
      id: 2,
      name: 'Paris',
      coord: { lat: 48.8566, lng: 2.3522 },
      labels: ['city', 'capital'],
      meta: 2161000,
      rank: 1
    },
    {
      id: 3,
      name: 'Tokyo',
      coord: null,
      labels: null,
      meta: null,
      rank: 2
    },
    {
      id: 4,
      name: 'New York',
      coord: { lat: 40.7128, lng: -74.006 },
      labels: ['city'],
      meta: 10001
    },
    {
      id: 5,
      name: 'Null Island',
      coord: { lat: 0.0, lng: 0.0 },
      labels: ['joke']
    },
    {
      id: 6,
      name: 'Sydney',
      coord: { lat: -33.8688, lng: 151.2093 },
      labels: [],
      rank: 3
    },
    {
      id: 7,
      name: 'Empty',
      coord: null,
      labels: []
    },
    {
      id: 8,
      name: 'London',
      coord: { lat: 51.5074, lng: -0.1278 },
      labels: ['city', 'capital', 'historic'],
      meta: 1572,
      rank: 4
    },
    {
      id: 9,
      name: 'Tiny',
      coord: { lat: 1.0, lng: 1.0 },
      labels: null,
      rank: 99
    },
    {
      id: 10,
      name: 'Full',
      coord: { lat: -90.0, lng: 180.0 },
      labels: ['a', 'b', 'c', 'd', 'e'],
      rank: 0
    }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 21. Enum (numeric)
// ─────────────────────────────────────────────────────────────────────────────
test('enum (numeric) field encoding', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '21')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns21')

    ns.register({
      name: 'color',
      enum: ['red', 'green', 'blue']
    })

    ns.register({
      name: 'item',
      fields: [
        { name: 'name', type: 'string', required: true },
        { name: 'color', type: '@ns21/color', required: true }
      ]
    })
  })

  const colors = schema.module.getEnum('@ns21/color')
  const enc = schema.module.resolveStruct('@ns21/item')

  const cases = [
    { name: 'apple', color: colors.red },
    { name: 'leaf', color: colors.green },
    { name: 'sky', color: colors.blue },
    { name: 'cherry', color: colors.red },
    { name: 'ocean', color: colors.blue },
    { name: 'grass', color: colors.green },
    { name: 'fire', color: colors.red },
    { name: 'emerald', color: colors.green },
    { name: 'sapphire', color: colors.blue },
    { name: 'ruby', color: colors.red }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 22. Enum (strings)
// ─────────────────────────────────────────────────────────────────────────────
test('enum (strings) field encoding', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '22')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns22')

    ns.register({
      name: 'status',
      strings: true,
      enum: ['pending', 'active', 'closed']
    })

    ns.register({
      name: 'ticket',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'status', type: '@ns22/status', required: true }
      ]
    })
  })

  const statuses = schema.module.getEnum('@ns22/status')
  const enc = schema.module.resolveStruct('@ns22/ticket')

  const cases = [
    { id: 1, status: statuses.pending },
    { id: 2, status: statuses.active },
    { id: 3, status: statuses.closed },
    { id: 100, status: statuses.pending },
    { id: 0, status: statuses.active },
    { id: 999, status: statuses.closed },
    { id: 42, status: statuses.pending },
    { id: 7, status: statuses.active },
    { id: 50, status: statuses.closed },
    { id: 12345, status: statuses.active }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 23. Record (string → uint)
// ─────────────────────────────────────────────────────────────────────────────
test('record (string keys, uint values)', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '23')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns23')

    ns.register({
      name: 'scores',
      record: true,
      key: 'string',
      value: 'uint'
    })
  })

  const enc = schema.module.resolveStruct('@ns23/scores')

  const cases = [
    { alice: 10, bob: 20 },
    { x: 0 },
    { a: 1, b: 2, c: 3, d: 4, e: 5 },
    {},
    { longkey: 999999 },
    { one: 1 },
    { foo: 100, bar: 200, baz: 300 },
    { z: 255 },
    { hello: 42, world: 0 },
    { k1: 1, k2: 2, k3: 3 }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 24. Record (string → struct)
// ─────────────────────────────────────────────────────────────────────────────
test('record (string keys, struct values)', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '24')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns24')

    ns.register({
      name: 'entry',
      compact: true,
      fields: [
        { name: 'value', type: 'uint', required: true },
        { name: 'label', type: 'string', required: true }
      ]
    })

    ns.register({
      name: 'registry',
      record: true,
      key: 'string',
      value: '@ns24/entry'
    })
  })

  const enc = schema.module.resolveStruct('@ns24/registry')

  const cases = [
    { foo: { value: 1, label: 'one' } },
    { a: { value: 10, label: 'ten' }, b: { value: 20, label: 'twenty' } },
    {},
    { x: { value: 0, label: '' } },
    {
      k1: { value: 100, label: 'hundred' },
      k2: { value: 200, label: 'two hundred' },
      k3: { value: 300, label: 'three hundred' }
    },
    { single: { value: 42, label: 'answer' } },
    { big: { value: 999999, label: 'large' } },
    { a: { value: 1, label: 'a' }, z: { value: 26, label: 'z' } },
    { test: { value: 7, label: 'seven' } },
    { m: { value: 50, label: 'fifty' }, n: { value: 60, label: 'sixty' } }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 25. JSON field
// ─────────────────────────────────────────────────────────────────────────────
test('json field encoding', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '25')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns25')

    ns.register({
      name: 'doc',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'payload', type: 'json' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns25/doc')

  const cases = [
    { id: 1, payload: { key: 'value' } },
    { id: 2, payload: null },
    { id: 3, payload: [1, 2, 3] },
    { id: 4, payload: 'just a string' },
    { id: 5, payload: 42 },
    { id: 6, payload: true },
    { id: 7, payload: { nested: { deep: [1, 'two', false] } } },
    { id: 8, payload: {} },
    { id: 9, payload: [] },
    { id: 10, payload: null }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 26. Versioned struct (version-tagged dispatch)
// ─────────────────────────────────────────────────────────────────────────────
test('versioned struct dispatch', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '26')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns26')

    ns.register({
      name: 'msgV0',
      fields: [
        { name: 'version', type: 'uint', required: true },
        { name: 'text', type: 'string', required: true }
      ]
    })

    ns.register({
      name: 'msgV1',
      fields: [
        { name: 'version', type: 'uint', required: true },
        { name: 'text', type: 'string', required: true },
        { name: 'priority', type: 'uint' }
      ]
    })

    ns.register({
      name: 'message',
      versions: [
        { version: 0, type: '@ns26/msgV0' },
        { version: 1, type: '@ns26/msgV1' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns26/message')

  const cases = [
    { version: 0, text: 'hello' },
    { version: 1, text: 'hello', priority: 5 },
    { version: 0, text: '' },
    { version: 1, text: 'urgent', priority: 0 },
    { version: 0, text: 'foo bar baz' },
    { version: 1, text: 'x', priority: 999 },
    { version: 0, text: 'a' },
    { version: 1, text: 'long message here', priority: 1 },
    { version: 0, text: 'test' },
    { version: 1, text: 'final', priority: 42 }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 27. uint field only
// ─────────────────────────────────────────────────────────────────────────────
test('uint field only', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '27')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns27')
    ns.register({
      name: 'counter',
      compact: true,
      fields: [{ name: 'value', type: 'uint', required: true }]
    })
  })

  const enc = schema.module.resolveStruct('@ns27/counter')

  const cases = [
    { value: 0 },
    { value: 1 },
    { value: 127 },
    { value: 128 },
    { value: 255 },
    { value: 256 },
    { value: 65535 },
    { value: 65536 },
    { value: 2 ** 32 - 1 },
    { value: 2 ** 32 }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 32. required + optional uint fields
// ─────────────────────────────────────────────────────────────────────────────
test('required and optional uint fields', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '32')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns32')
    ns.register({
      name: 'item',
      fields: [
        { name: 'id', type: 'uint', required: true },
        { name: 'count', type: 'uint' }
      ]
    })
  })

  const enc = schema.module.resolveStruct('@ns32/item')

  const cases = [
    { id: 1, count: null },
    { id: 1, count: 0 },
    { id: 1, count: 42 },
    { id: 255, count: null },
    { id: 1, count: 127 },
    { id: 1, count: 128 },
    { id: 1, count: 65535 },
    { id: 1, count: 65536 },
    { id: 1, count: 2 ** 32 - 1 },
    { id: 1, count: 2 ** 32 }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 28. string field only
// ─────────────────────────────────────────────────────────────────────────────
test('string field only', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '28')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns28')
    ns.register({
      name: 'label',
      compact: true,
      fields: [{ name: 'value', type: 'string', required: true }]
    })
  })

  const enc = schema.module.resolveStruct('@ns28/label')

  const cases = [
    { value: '' },
    { value: 'a' },
    { value: 'hello' },
    { value: 'hello world' },
    { value: '🎉' },
    { value: 'café' },
    { value: 'a'.repeat(100) },
    { value: 'line1\nline2' },
    { value: '\t\t' },
    { value: '日本語' }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 29. bool field only
// ─────────────────────────────────────────────────────────────────────────────
test('bool field only', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '29')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns29')
    ns.register({
      name: 'flag',
      compact: true,
      fields: [{ name: 'value', type: 'bool', required: true }]
    })
  })

  const enc = schema.module.resolveStruct('@ns29/flag')

  const cases = [
    { value: true },
    { value: false },
    { value: true },
    { value: false },
    { value: true },
    { value: false },
    { value: true },
    { value: true },
    { value: false },
    { value: false }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 30. float32 field only
// ─────────────────────────────────────────────────────────────────────────────
test('float32 field only', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '30')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns30')
    ns.register({
      name: 'measurement',
      compact: true,
      fields: [{ name: 'value', type: 'float32', required: true }]
    })
  })

  const enc = schema.module.resolveStruct('@ns30/measurement')

  const cases = [
    { value: 0 },
    { value: 1 },
    { value: -1 },
    { value: 0.5 },
    { value: -0.5 },
    { value: 3.140000104904175 },
    { value: 1.0000001192092896 },
    { value: 3.4028234663852886e38 },
    { value: 1.1754943508222875e-38 },
    { value: -273.1499938964844 }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})

// ─────────────────────────────────────────────────────────────────────────────
// 31. float64 field only
// ─────────────────────────────────────────────────────────────────────────────
test('float64 field only', async (t) => {
  const schema = await createTestSchema(t, fixtureDir, '31')

  await schema.rebuild((s) => {
    const ns = s.namespace('ns31')
    ns.register({
      name: 'precise',
      compact: true,
      fields: [{ name: 'value', type: 'float64', required: true }]
    })
  })

  const enc = schema.module.resolveStruct('@ns31/precise')

  const cases = [
    { value: 0 },
    { value: 1 },
    { value: -1 },
    { value: 0.1 + 0.2 },
    { value: -0.5 },
    { value: 3.141592653589793 },
    { value: Number.MAX_SAFE_INTEGER },
    { value: Number.MIN_SAFE_INTEGER },
    { value: 1.7976931348623157e308 },
    { value: 5e-324 }
  ]

  const encoded = []
  for (const obj of cases) {
    encoded.push(c.encode(enc, obj).toString('hex'))
  }

  await schema.save(cases, encoded)
})
