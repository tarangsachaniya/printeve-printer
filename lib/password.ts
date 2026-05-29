export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'At least 8 characters required.'
  if (!/[A-Z]/.test(pw)) return 'Must include an uppercase letter.'
  if (!/[a-z]/.test(pw)) return 'Must include a lowercase letter.'
  if (!/[0-9]/.test(pw)) return 'Must include a number.'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Must include a special character.'
  return null
}
