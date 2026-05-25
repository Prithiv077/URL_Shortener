
# Rate Limiting Added

## What It Does
Protects backend APIs from:
- Spam
- Brute-force attacks
- API abuse
- Too many requests

## Configuration
- Max 100 requests
- Per 15 minutes
- Per IP address

## Example
If a user sends:
500 requests quickly

Backend returns:
429 Too Many Requests

## Why This Matters
This is a real production-level backend security feature.

Most student projects DON'T include:
- rate limiting
- abuse protection
- traffic control

Adding this makes the project much more backend-engineering oriented.

## Interview Value
You can now discuss:
- DDOS prevention basics
- brute force protection
- API throttling
- backend security
