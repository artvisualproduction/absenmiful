import type { MinimalApiResponse } from '../_lib/apiError';
import type { ApiRequestLike } from '../_lib/auth/middleware';
import { handleHolidayById } from './index';

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleHolidayById(req, res);
}
