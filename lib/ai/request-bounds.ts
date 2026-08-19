/*
  Bounds on one chat request's shape. The limiter counts requests, not size, so
  without these one enormous turn passes a cap built for a normal one.

  Not in `route.ts`: its export surface is closed to Next's own keys, so a
  constant there cannot be imported by the test tying `MAX_REQUEST_MESSAGES` to
  the saved-message cap.
*/

export const MAX_REQUEST_MESSAGES = 100;
export const MAX_TOTAL_CHARS = 200_000;
export const MAX_QUESTION_CHARS = 8_000;
