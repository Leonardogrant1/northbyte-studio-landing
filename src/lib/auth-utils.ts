/**
 * Validate if an email is a northbyte.studio email
 * This is a client-safe utility function
 */
export function isNorthByteEmail(email: string): boolean {
    return email.endsWith("@northbyte.studio");
}
