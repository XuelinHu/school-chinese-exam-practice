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
 * @param {object} [options.filters] 初始筛选条件（会一并带上 lang）
 * @param {number} [options.pageSize]
 * @param {boolean} [options.immediate] 是否挂载即加载，默认 true
 */
export function usePagedTable(path, { filters = {}, pageSize = 10, immediate = true } = {}) {
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
      const data = await request(`${path}${qs({ ...query, page: page.value, pageSize: size.value })}`);
      rows.value = data?.list ?? [];
      total.value = data?.total ?? 0;
      totalPages.value = data?.totalPages ?? 1;
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

  if (immediate) onMounted(load);

  return {
    rows, total, totalPages, loading, error,
    query, page, size,
    load, search, reset, changePage, changePageSize
  };
}
