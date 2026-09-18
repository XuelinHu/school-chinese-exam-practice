import { HttpError } from '../utils/errors.js';

/**
 * 系统角色。两端各两种：
 *  - 用户端：`student` 学员（自助注册默认）、`teacher` 教师（只读教学查看区）
 *  - 管理端：`admin` 超级管理员、`content_admin` 内容管理员（题库/试卷/等级/分类）
 *
 * 权限写成常量矩阵而不是散落的字符串字面量：新增角色时 `ALL_ROLES` 自动带上，
 * 而用 `STAFF_ROLES.includes(role)` 这类判断也不会有哪一处漏改。
 *
 * **前端隐藏菜单只是体验，真正的权限边界在这里和路由上的 `allow()`。**
 */
export const ROLE = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin',
  CONTENT_ADMIN: 'content_admin'
};

/** users.role 的合法取值，与迁移 003 的 ENUM 定义一致。 */
export const ALL_ROLES = Object.values(ROLE);

/** 能进后台的角色。 */
export const STAFF_ROLES = [ROLE.ADMIN, ROLE.CONTENT_ADMIN];

/** 能看教学查看区（只读）的角色。 */
export const TEACHING_ROLES = [ROLE.TEACHER, ROLE.ADMIN];

export function isStaff(role) {
  return STAFF_ROLES.includes(role);
}

export function allow(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'Forbidden'));
    }
    return next();
  };
}
