# hyperschema-fixtures

In `fixtures` directory you will find the `schema.json` and `test.json` with values and their expected encodings.

`values` and `encoded` are for the latest version of the schema, and the type they encode is the last one in `schema.json`. Where a fixture also covers older versions of that schema, `test.json` carries a `versioned` array of `{ version, values, encoded }` - one entry per older version, oldest first. Implementations that ignore `versioned` still verify the latest version.
