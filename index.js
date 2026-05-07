const p = require('path')
const fs = require('fs')
const tmp = require('test-tmp')

const Hyperschema = require('hyperschema')

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

  async save(values, encoded) {
    await fs.promises.copyFile(
      p.join(this.dir, 'schema.json'),
      p.resolve(this.fixtureDir, this.name, 'schema.json')
    )

    await fs.promises.writeFile(
      p.resolve(this.fixtureDir, this.name, 'test.json'),
      JSON.stringify({ values, encoded }) + '\n'
    )
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
