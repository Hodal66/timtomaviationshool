import type { Prisma } from "@prisma/client";
/** Website enquiries, as opposed to the lead record every application also creates. A missing message must still count as an enquiry. */
export const ENQUIRY: Prisma.LeadWhereInput = { OR: [{ message: null }, { NOT: { message: { startsWith: "Application " } } }] };
