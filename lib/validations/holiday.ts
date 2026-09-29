import { z } from "zod"

export const holidaySchema = z.object({
  name: z.string().trim().min(2, "Enter a holiday name.").max(100, "Use 100 characters or fewer."),
  holiday_date: z.iso.date("Choose a date."),
  description: z.string().trim().max(500, "Use 500 characters or fewer."),
  is_optional: z.boolean(),
})

export type HolidayInput = z.infer<typeof holidaySchema>
