const { validateRuntime } = require('./windows-runtime.cjs');
console.log(JSON.stringify(validateRuntime(), null, 2));
