import { CollectionName, TeacherStatus, UserRole, type SafeUser, type Teacher } from '../../../src/types';
import type { IDataRepository } from '../repository/types';

/**
 * Resolves the active Teacher profile linked to a TEACHER or PRINCIPAL user.
 * For PRINCIPAL users whose `linkedTeacherId` was not yet populated manually,
 * automatically locates an active teacher record whose position indicates
 * Kepala Sekolah / Kepala Madrasah and links it so daily principal attendance works seamlessly.
 */
export async function resolveTeacherProfileForUser(
  repo: IDataRepository,
  user: Pick<SafeUser, 'id' | 'role' | 'linkedTeacherId'>,
): Promise<Teacher | null> {
  const teacherCol = repo.collection(CollectionName.TEACHERS);

  if (user.linkedTeacherId) {
    const direct = await teacherCol.getById(user.linkedTeacherId);
    if (direct && direct.status === TeacherStatus.ACTIVE) {
      return direct;
    }
  }

  if (user.role === UserRole.PRINCIPAL) {
    const allTeachers = await teacherCol.list({
      filters: [{ field: 'status', op: '==', value: TeacherStatus.ACTIVE }],
    });
    const matched =
      allTeachers.items.find((t) => {
        const pos = t.position.toLowerCase();
        return pos.includes('kepala sekolah') || pos.includes('kepala madrasah') || pos.includes('kepsek');
      }) ??
      allTeachers.items.find((t) => t.userId === user.id) ??
      null;

    if (matched) {
      // Best-effort sync of linkedTeacherId onto user record
      try {
        await repo.collection(CollectionName.USERS).update(user.id, {
          linkedTeacherId: matched.id,
        });
      } catch {
        // Non-fatal
      }
      return matched;
    }
  }

  return null;
}
