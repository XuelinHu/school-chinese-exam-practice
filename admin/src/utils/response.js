export function ok(res, data = null, message = 'success') {
  return res.json({ code: 200, message, data });
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
