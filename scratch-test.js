fetch('http://127.0.0.1:4000/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `mutation {
      createTenant(input: { name: "Test", email: "test@test.com", password: "password123" }) {
        id
        name
        email
      }
    }`
  })
})
.then(res => res.text())
.then(console.log)
.catch(console.error);
