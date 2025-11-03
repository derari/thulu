# HTTP Parser Tests

## Test Cases

### Example 1: Simple sections
```http
### Get Users
GET https://api.example.com/users

### Create User
POST https://api.example.com/users
Content-Type: application/json

{
  "name": "John"
}

### Delete User
DELETE https://api.example.com/users/1
```

Expected output:
- Section 1: "Get Users" (line 1)
- Section 2: "Create User" (line 4)
- Section 3: "Delete User" (line 11)

### Example 2: Untitled sections
```http
###
GET https://api.example.com/test

### Named Section
POST https://api.example.com/test
```

Expected output:
- Section 1: "Untitled" (line 1)
- Section 2: "Named Section" (line 4)

### Example 3: No sections
```http
GET https://api.example.com/test
```

Expected output:
- No sections (empty array)

