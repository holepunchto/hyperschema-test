const p = require('path')
const fs = require('fs')
const tmp = require('test-tmp')

const Hyperschema = require('hyperschema')

const update = process.argv.includes('--update')

class TestBuilder {
  constructor(dir, fixtureDir, name, test) {
    this.test = test
    this.dir = dir
    this.fixtureDir = fixtureDir
    this.name = name
    this.module = null
    this.version = 0
  }

  async rebuild(builder) {
    const schema = Hyperschema.from(this.dir)

    builder(schema)

    this.dir = await makeDir(this.test)

    Hyperschema.toDisk(schema, this.dir)

    this.module = require(this.dir)
    this.json = require(p.join(this.dir, 'schema.json'))

    return schema
  }

  resolve(name, version) {
    if (this.module) throw new Error('Module is not set on TestBuilder')
    return this.module.resolveStruct(name, version)
  }

  // Asserts that the committed fixture is what hyperschema produces now. Pass
  // --update to rewrite the fixtures instead
  async save(values, encoded) {
    const dir = p.resolve(this.fixtureDir, this.name)

    const schema = await fs.promises.readFile(p.join(this.dir, 'schema.json'), 'utf-8')
    const test = JSON.stringify({ values, encoded }, null, 2) + '\n'

    if (update) {
      await fs.promises.mkdir(dir, { recursive: true })
      await fs.promises.writeFile(p.join(dir, 'schema.json'), schema)
      await fs.promises.writeFile(p.join(dir, 'test.json'), test)
      return
    }

    const committed = await readFixture(dir)

    if (committed === null) {
      this.test.fail(`fixture ${this.name} is not committed, run npm run generate`)
      return
    }

    this.test.is(committed.schema, schema, `fixture ${this.name} schema.json`)
    this.test.is(committed.test, test, `fixture ${this.name} test.json`)
  }
}

async function readFixture(dir) {
  try {
    return {
      schema: await fs.promises.readFile(p.join(dir, 'schema.json'), 'utf-8'),
      test: await fs.promises.readFile(p.join(dir, 'test.json'), 'utf-8')
    }
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

async function makeDir(t) {
  const dir = await tmp(t, { dir: p.resolve(__dirname, 'storage') })

  // Copy the runtime into the tmp dir so that we don't need to override it in the codegen
  const runtimePath = p.join(dir, 'node_modules', 'hyperschema', 'runtime.cjs')
  await fs.promises.mkdir(p.dirname(runtimePath), { recursive: true })

  await fs.promises.copyFile(
    p.resolve(__dirname, 'node_modules', 'hyperschema', 'runtime.cjs'),
    runtimePath
  )

  return dir
}

async function createTestSchema(t, fixtureDir, name) {
  const dir = await makeDir(t)
  return new TestBuilder(dir, fixtureDir, name, t)
}

module.exports = {
  createTestSchema
}
