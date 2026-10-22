# AI Log

## Build 1

### Entry 1: (First Run)
- **I wanted the ticket Id to carry the name of theuser and then the code afterwards**
- **AI gave me the script - export function newReference(personName) {
  const cleanName = personName.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return `${cleanName}-${randomChars(5)}`; **
- **what was wrong here is the security bridge in the fact that the story categorically says that the name must not appear with the QR scan, and since that will create a bridge my AI updated with a better script - export function newReference() {
  return `${randomChars(4)}-${randomChars(4)}`; **

## Build 2

### Entry 1: Build 2 implementation
- **What I asked:** Implement search, filtering, stable merge sort, publishing, unpublishing and automated tests using the teacher's Build 2 requirements.
- **What came back:** Added the Build 2 domain functions, `node:test` tests, runnable trial examples and the `npm test` command. Kept money in kobo and retained a separate ID for every booking and ticket.
- **What was wrong (or "nothing"):** The teacher's prompt says cents and names publishing but not unpublishing; these were adapted to kobo and the agreed S04 publish/unpublish criteria. An invalid calendar date was also being normalized by JavaScript, so real-date validation was tightened.
- **Agreed S04 criteria:** Publishing a tiered draft makes it public; publishing without tiers returns `INVALID_STATE` and keeps it hidden; unpublishing returns it to draft and removes it from the public list.
