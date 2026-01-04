# Quiz API (MVP)

Base URL: `http://localhost:4000`

## Error format

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "日本語の説明",
    "details": {}
  }
}
```

## Auth

### POST /api/auth/register

Request:

```json
{ "email": "user@example.com", "password": "Password123!" }
```

Response:

```json
{ "ok": true }
```

### POST /api/auth/verify

Request:

```json
{ "token": "..." }
```

Response:

```json
{ "ok": true }
```

### POST /api/auth/login

Request:

```json
{ "email": "user@example.com", "password": "Password123!" }
```

Response:

```json
{ "user": { "id": "...", "email": "user@example.com", "role": "USER" } }
```

### POST /api/auth/logout

Response:

```json
{ "ok": true }
```

### POST /api/auth/forgot

Request:

```json
{ "email": "user@example.com" }
```

Response:

```json
{ "ok": true }
```

### POST /api/auth/reset

Request:

```json
{ "token": "...", "newPassword": "Password123!" }
```

Response:

```json
{ "ok": true }
```

## Admin Invites

### POST /api/admin/invites (ADMIN)

Request:

```json
{ "email": "admin2@example.com" }
```

Response:

```json
{ "ok": true }
```

### POST /api/admin/invites/accept

Request:

```json
{ "token": "...", "password": "Password123!" }
```

Response:

```json
{ "ok": true }
```

## Admin CRUD (ADMIN)

### GET /api/admin/units

Response:

```json
{ "units": [{ "id": 1, "name": "ネットワーク基礎", "sortOrder": 1 }] }
```

### POST /api/admin/units

Request:

```json
{ "name": "OS基礎", "sortOrder": 2 }
```

### PUT /api/admin/units

Request:

```json
{ "id": 1, "name": "ネットワーク基礎", "sortOrder": 1 }
```

### DELETE /api/admin/units

Request:

```json
{ "id": 1 }
```

### GET /api/admin/categories

Response:

```json
{ "categories": [{ "id": 1, "unitId": 1, "name": "TCP/IP", "sortOrder": 1 }] }
```

### POST /api/admin/categories

Request:

```json
{ "unitId": 1, "name": "DNS", "sortOrder": 2 }
```

### PUT /api/admin/categories

Request:

```json
{ "id": 1, "unitId": 1, "name": "TCP/IP", "sortOrder": 1 }
```

### DELETE /api/admin/categories

Request:

```json
{ "id": 1 }
```

### GET /api/admin/questions

Response:

```json
{
  "questions": [
    {
      "id": 1,
      "categoryId": 1,
      "body": "...",
      "explanation": "...",
      "isActive": true,
      "choices": [
        { "id": 1, "label": "A", "body": "...", "isCorrect": true }
      ]
    }
  ]
}
```

### POST /api/admin/questions

Request:

```json
{
  "categoryId": 1,
  "body": "問題文",
  "explanation": "解説",
  "isActive": true,
  "choices": [
    { "label": "A", "body": "選択肢A", "isCorrect": true },
    { "label": "B", "body": "選択肢B", "isCorrect": false },
    { "label": "C", "body": "選択肢C", "isCorrect": false },
    { "label": "D", "body": "選択肢D", "isCorrect": false }
  ]
}
```

### PUT /api/admin/questions

Request:

```json
{
  "id": 1,
  "categoryId": 1,
  "body": "問題文",
  "explanation": "解説",
  "isActive": true,
  "choices": [
    { "label": "A", "body": "選択肢A", "isCorrect": true },
    { "label": "B", "body": "選択肢B", "isCorrect": false },
    { "label": "C", "body": "選択肢C", "isCorrect": false },
    { "label": "D", "body": "選択肢D", "isCorrect": false }
  ]
}
```

### DELETE /api/admin/questions

Request:

```json
{ "id": 1 }
```

### PATCH /api/admin/questions/:id/active

Request:

```json
{ "isActive": false }
```

## Quiz

### POST /api/quiz/start

Request:

```json
{ "mode": "A", "requestedCount": 10, "unitId": 1 }
```

Response:

```json
{
  "attemptId": "...",
  "currentSeq": 1,
  "total": 10,
  "question": {
    "id": 12,
    "body": "問題文",
    "choices": [
      { "label": "A", "body": "選択肢A" },
      { "label": "B", "body": "選択肢B" },
      { "label": "C", "body": "選択肢C" },
      { "label": "D", "body": "選択肢D" },
      { "label": "UNKNOWN", "body": "わからない" }
    ]
  },
  "resultAvailable": false
}
```

### POST /api/quiz/answer

Request:

```json
{ "attemptId": "...", "questionId": 12, "answer": "A" }
```

Response (next question):

```json
{
  "attemptId": "...",
  "currentSeq": 2,
  "total": 10,
  "question": { "id": 13, "body": "...", "choices": [] },
  "resultAvailable": false
}
```

Response (last answer):

```json
{ "resultAvailable": true }
```

### GET /api/quiz/result?attemptId=...

Response:

```json
{
  "attemptId": "...",
  "score": 7,
  "total": 10,
  "results": [
    {
      "questionId": 12,
      "body": "問題文",
      "userAnswer": "A",
      "correctAnswer": "A",
      "isCorrect": true,
      "explanation": "解説"
    }
  ]
}
```
