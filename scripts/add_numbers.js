// Simple function that adds two numbers and prints the test result

function add_numbers(a, b) {
  return a + b
}

// Test with values 5 and 3, then print the result exactly as required
const a = 5
const b = 3
const result = add_numbers(a, b)
console.log(`${a} + ${b} = ${result}`)

module.exports = { add_numbers }
