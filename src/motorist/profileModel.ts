export type MotoristProfile = {
  name: string
  email: string
  phone: string
}

export const demoProfile: MotoristProfile = {
  name: "Juan Dela Cruz",
  email: "juan@example.com",
  phone: "",
}

export function normalizePhone(phone: string) {
  const compact = phone.trim().replace(/[\s()-]/g, "")
  if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`
  if (/^9\d{9}$/.test(compact)) return `+63${compact}`
  if (/^639\d{9}$/.test(compact)) return `+${compact}`
  return compact
}

export function cleanProfile(profile: MotoristProfile): MotoristProfile {
  return {
    name: profile.name.trim().replace(/\s+/g, " "),
    email: profile.email.trim(),
    phone: normalizePhone(profile.phone),
  }
}

export function validateProfile(
  profile: MotoristProfile,
): Partial<Record<keyof MotoristProfile, string>> {
  const value = cleanProfile(profile)
  const errors: Partial<Record<keyof MotoristProfile, string>> = {}
  if (value.name.length < 2 || value.name.length > 80)
    errors.name = "Enter a name between 2 and 80 characters."
  if (
    value.email &&
    (value.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
  )
    errors.email =
      "Enter a valid email address, or leave this optional field blank."
  if (value.phone && !/^\+639\d{9}$/.test(value.phone))
    errors.phone =
      "Enter a Philippine mobile number, such as 09 followed by 9 digits, or leave it blank."
  return errors
}

export function profileInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return "M"
  return (
    Array.from(words[0])[0] +
    (words.length > 1 ? Array.from(words[words.length - 1])[0] : "")
  ).toLocaleUpperCase()
}
