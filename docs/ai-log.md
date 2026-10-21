# AI Log

## Build 1

### Entry 1: (First Run)
- **I wanted the ticket Id to carry the name of theuser and then the code afterwards**
- **AI gave me the script - export function newReference(personName) {
  const cleanName = personName.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return `${cleanName}-${randomChars(5)}`; **
- **what was wrong here is the security bridge in the fact that the story categorically says that the name must not appear with the QR scan, and since that will create a bridge my AI updated with a better script - export function newReference() {
  return `${randomChars(4)}-${randomChars(4)}`; **
