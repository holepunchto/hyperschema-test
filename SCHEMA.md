# Schema format

This document is the normative definition of how hyperschema maps a schema onto compact-encoding codecs. It is a first draft: the rules below are each pinned by a fixture and were derived by decoding those fixtures, but the document does not yet cover the whole surface. What is missing is listed under [Not yet specified](#not-yet-specified) rather than left for a reader to discover.

Where this document and `fixtures/` disagree, `fixtures/` wins; file an issue and fix the prose.

A schema is a list of type definitions. Each definition is a struct, an alias or an enum, and the encoding of a value is determined entirely by its definition plus the rules here.

## Structs

A struct encodes its fields in declaration order. Nothing frames the struct itself, so the fields follow one another directly and a decoder relies on the definition to know where each begins.

### The flags word

A struct with at least one optional field carries a **flags word**: a bitmask recording which optional fields are present. `flagsPosition` gives the field index the word is written at, so the word is not necessarily first.

Fixture 1 declares a required `id` then an optional `label` with `flagsPosition: 1`, so the word sits between them:

```
{ id: 1, label: "hello" }  ->  01 01 05 68656c6c6f
                               id flags len "hello"
```

Bit `n` of the word corresponds to the `n`th **optional** field in declaration order; required fields are not counted and never appear in it. Fixture 18 has one required field and five optional ones, and sets each bit independently: `name` is bit 0, `age` bit 1, `active` bit 2.

**`flagsPosition: -1` means the struct has no optional fields and no flags word is written at all.** Fixture 3 is two required `int` fields and encodes as just those two values.

### Presence is truthiness, not nullness

An optional field is recorded as present only when its value is **truthy**. A value of `0`, `""` or `false` is encoded exactly as `null` is: the bit stays clear and no value bytes are written.

```
fixture 32   { id: 1, count: 0 }     ->  01 00     identical to count: null
fixture 16   { id: 6, tag: "" }      ->  06 00     identical to tag: null
```

This is the single most surprising rule in the format, and it has a consequence a decoder cannot avoid: **decoding is not the inverse of encoding.** Encoding `{ count: 0 }` and decoding the result yields a value whose `count` is absent, so an implementation cannot assert `decode(encode(v)) == v`. The reference conformance suite works around this by re-encoding instead, and says so:

> Decoding is only asserted through re-encoding: the builder encodes falsy optionals as absent, so a decoded value need not match the input value.

An implementation is conformant if it reproduces the fixture bytes when encoding and reproduces those same bytes when it re-encodes what it decoded. Round-trip identity is not required and must not be assumed.

### Optional booleans

An optional `bool` occupies **only its presence bit**. No value bytes follow: `true` is a set bit, `false` is a clear one.

```
fixture 18   { id: 4, active: true }  ->  04 04
                                          id flags(bit 2)
```

Fixture 29 is the degenerate case - a struct whose only field is an optional `bool`, which therefore encodes to a single flags byte and nothing else.

## Not yet specified

Each of these is exercised by a fixture, so the behaviour is pinned by bytes; none of it is yet written down here. Listed roughly in the order a port will need it.

- **The flags word's own codec.** Whether it is a varint or a fixed-width integer, and whether that differs between compact and non-compact structs. `fixtures/index.json` lists `compact` (3), `flags-position` (11) and `multiple-optional-flags` (18).
- **`compact`.** What the modifier changes beyond the cases above, and how it interacts with optional fields.
- **Nested structs**, and the framed-versus-inline distinction: fixtures 8, 12.
- **Arrays and records**: fixtures 6, 7, 23, 24.
- **Aliases and enums**: fixtures 9, 21, 22.
- **Versioning** - how a field's `version` and a schema's `version` affect the encoding, and what an older reader does with a newer value: fixtures 2, 19, 26.
- **The primitive types themselves.** `uint`, `int` and their sized variants, `float32`/`float64`, `fixed32`/`fixed64`, `string`, `buffer`, `json`. These belong to compact-encoding rather than to hyperschema, and the right home for them is a compact-encoding corpus rather than this document; until one exists they are specified nowhere.
- **`fixtures/17`** appears in no category in `fixtures/index.json`, so what it is meant to exercise is unrecorded.
