import { describe, it, expect } from 'vitest';
import { extractRequestFromSection } from './requestExtractor';

describe('extractRequestFromSection', () => {
    it('should extract simple GET request', () => {
        const content = `### Get Users
GET https://api.example.com/users`;

        const result = extractRequestFromSection(content, 1);

        expect(result).toEqual({
            verb: 'GET',
            url: 'https://api.example.com/users',
            headers: {},
            body: ''
        });
    });

    it('should extract POST request with headers and body', () => {
        const content = `### Create User
POST https://api.example.com/users
Content-Type: application/json
Authorization: Bearer token123

{
  "name": "John",
  "email": "john@example.com"
}`;

        const result = extractRequestFromSection(content, 1);

        expect(result).toEqual({
            verb: 'POST',
            url: 'https://api.example.com/users',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token123'
            },
            body: '{\n  "name": "John",\n  "email": "john@example.com"\n}'
        });
    });

    it('should extract request with multiple headers', () => {
        const content = `### Test Request
PUT https://api.example.com/test
Content-Type: application/json
Accept: application/json
X-Custom-Header: value

{"test": true}`;

        const result = extractRequestFromSection(content, 1);

        expect(result).toEqual({
            verb: 'PUT',
            url: 'https://api.example.com/test',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Custom-Header': 'value'
            },
            body: '{"test": true}'
        });
    });

    it('should handle request without body', () => {
        const content = `### Delete User
DELETE https://api.example.com/users/1
Authorization: Bearer token123`;

        const result = extractRequestFromSection(content, 1);

        expect(result).toEqual({
            verb: 'DELETE',
            url: 'https://api.example.com/users/1',
            headers: {
                'Authorization': 'Bearer token123'
            },
            body: ''
        });
    });

    it('should stop at next section marker', () => {
        const content = `### First Request
GET https://api.example.com/first

### Second Request
GET https://api.example.com/second`;

        const result = extractRequestFromSection(content, 1);

        expect(result).toEqual({
            verb: 'GET',
            url: 'https://api.example.com/first',
            headers: {},
            body: ''
        });
    });

    it('should return null for section without verb', () => {
        const content = `### Divider
Just some text`;

        const result = extractRequestFromSection(content, 1);

        expect(result).toBeNull();
    });

    it('should handle section at end of file', () => {
        const content = `### Get Users
GET https://api.example.com/users
Authorization: Bearer token

### Last Request
POST https://api.example.com/last
Content-Type: application/json

{"data": "test"}`;

        const result = extractRequestFromSection(content, 5);

        expect(result).toEqual({
            verb: 'POST',
            url: 'https://api.example.com/last',
            headers: {
                'Content-Type': 'application/json'
            },
            body: '{"data": "test"}'
        });
    });

    it('should skip comments when finding request line', () => {
        const content = `### First Request

# this is a comment

GET http://localhost/path
Authorization: Bearer token

# this is more comment`;

        const result = extractRequestFromSection(content, 1);

        expect(result).toEqual({
            verb: 'GET',
            url: 'http://localhost/path',
            headers: {
                'Authorization': 'Bearer token'
            },
            body: ''
        });
    });

    it('should handle XML body', () => {
        const content = `### Third Request

POST http://localhost/path
Authorization: Bearer token
Content-Type: application/xml

<xml>
    <foo>1</foo>
</xml>`;

        const result = extractRequestFromSection(content, 1);

        expect(result).toEqual({
            verb: 'POST',
            url: 'http://localhost/path',
            headers: {
                'Authorization': 'Bearer token',
                'Content-Type': 'application/xml'
            },
            body: '<xml>\n    <foo>1</foo>\n</xml>'
        });
    });
});

