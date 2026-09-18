import { reactive, ref, watch, onMounted } from 'vue';
import { request, qs } from '../api/client.js';
import { t } from '../i18n/index.js';

/**
 * 后台分页表格的公共逻辑。
 *
 * 每个菜单都是同一套：筛选条件 → 请求 → `{ list, total, page, pageSize, totalPages }`。
 * 这里封装掉请求、查询串拼装、搜索防抖、翻页与错误提示，页面只关心列怎么画。
 *
 * @param {string} path 接口路径，如 `/admin/questions`
 * @param {object} options
 * @param {object} [options.filters] 初始筛选条件，会随每次请求一起发送
 * @param {number} [options.pageSize]
 * @param {boolean} [options.immediate] 是否挂载即加载，默认 true
 * @param {(data: object) => void} [options.onLoaded] 拿到完整响应信封。
 *   分页四件套之外的附加字段（如在线接口的 `summary` / `windowMinutes`）用这个接。
 * @param {() => object} [options.extra] 不入筛选表单、但随每次请求发送的参数。
 *   写成 getter 是为了让 `lang` 这类外部状态变化能被追踪到并自动重查；
 *   放进 `filters` 会被 `reset()` 按初始值回滚，切了语言再点重置就发错语言了。
 */
export function usePagedTable(
  path,
  { filters = {}, pageSize = 10, immediate = true, extra = null, onLoaded = null } = {}
) {
  const rows = ref([]);
  const total = ref(0);
  const totalPages = ref(1);
  const loading = ref(false);
  const error = ref('');

  const query = reactive({ ...filters });
  const page = ref(1);
  const size = ref(pageSize);

  async function load() {
    loading.value = true;
    error.value = '';
    try {
      const params = { ...query, ...(extra ? extra() : {}), page: page.value, pageSize: size.value };
      const data = await request(`${path}${qs(params)}`);
      rows.value = data?.list ?? [];
      total.value = data?.total ?? 0;
      totalPages.value = data?.totalPages ?? 1;
      onLoaded?.(data ?? {});
      // 删到最后一页空了就自动回退一页，避免停在空白页
      if (!rows.value.length && page.value > 1 && total.value > 0) {
        page.value = Math.min(page.value - 1, totalPages.value);
        return load();
      }
    } catch (err) {
      error.value = err.message || t('empty');
      rows.value = [];
      total.value = 0;
    } finally {
      loading.value = false;
    }
  }

  /** 改筛选条件后回到第一页重新查。 */
  function search() {
    page.value = 1;
    return load();
  }

  function reset() {
    for (const key of Object.keys(query)) query[key] = filters[key] ?? '';
    page.value = 1;
    return load();
  }

  function changePage(next) {
    page.value = Math.max(1, Math.min(next, totalPages.value || 1));
    return load();
  }

  function changePageSize(next) {
    size.value = Number(next) || pageSize;
    page.value = 1;
    return load();
  }

  // 关键词类筛选输入时防抖，避免每敲一个字母打一次库
  let timer = null;
  watch(
    () => ({ ...query }),
    () => {
      clearTimeout(timer);
      timer = setTimeout(search, 350);
    },
    { deep: true }
  );

  // extra 只读取它内部用到的响应式状态（如 i18n 的 lang），因此这里不会误触发
  if (extra) watch(extra, () => search());

  if (immediate) onMounted(load);

  return {
    rows, total, totalPages, loading, error,
    query, page, size,
    load, search, reset, changePage, changePageSize
  };
}
