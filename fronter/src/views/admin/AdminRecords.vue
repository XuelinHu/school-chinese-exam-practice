<template>
  <section class="admin-panel" style="display:grid;gap:14px">
    <!-- 筛选：关键词（用户名/姓名/试卷标题）+ 提交日期区间 -->
    <div class="filters">
      <label class="grow">
        {{ t('search') }}
        <input v-model="query.keyword" type="text" :placeholder="t('username')" />
      </label>
      <label>
        {{ t('submittedAt') }}
        <span class="row">
          <input v-model="query.dateFrom" type="date" />
          <span class="muted">—</span>
          <input v-model="query.dateTo" type="date" />
        </span>
      </label>
      <button class="btn ghost" type="button" @click="reset">{{ t('reset') }}</button>
    </div>

    <p v-if="error" class="alert error">{{ error }}</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{{ t('username') }}</th>
            <th>{{ t('title') }}</th>
            <th>{{ t('correct') }}</th>
            <th>{{ t('wrong') }}</th>
            <th>{{ t('score') }}</th>
            <th>{{ t('accuracy') }}</th>
            <th>{{ t('duration') }}</th>
            <th>{{ t('submittedAt') }}</th>
            <th>{{ t('actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.id }}</td>
            <td>
              {{ row.username }}
              <span v-if="row.student_no" class="muted">· {{ row.student_no }}</span>
            </td>
            <td class="wrap">{{ row.paper_title }}</td>
            <td>{{ row.correct_count }}</td>
            <td>{{ row.wrong_count }}</td>
            <td>{{ row.total_score }}</td>
            <td>
              <div class="row" style="gap:6px">
                <span class="bar" style="flex:0 0 72px"><i :style="{ width: `${accuracy(row)}%` }" /></span>
                <span class="muted">{{ accuracy(row) }}%</span>
              </div>
            </td>
            <td>{{ formatDuration(row.duration_seconds) }}</td>
            <td>{{ formatTime(row.submitted_at) }}</td>
            <td>
              <div class="row-actions">
                <button class="btn ghost btn-sm" type="button" @click="openDetail(row)">{{ t('detail') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length && !loading" class="muted">{{ t('empty') }}</p>
    </div>

    <Pagination
      :page="page"
      :page-size="size"
      :total="total"
      :total-pages="totalPages"
      :loading="loading"
      @page="changePage"
      @size="changePageSize"
    />

    <!-- 详情：答题汇总 + 逐题作答 -->
    <AppModal v-model="detailOpen" :title="t('detail')" size="lg">
      <p v-if="detailError" class="alert error">{{ detailError }}</p>
      <p v-else-if="detailLoading" class="muted">{{ t('loading') }}</p>

      <template v-else-if="detail">
        <div class="form-grid">
          <div class="field">
            <span class="muted">{{ t('username') }}</span>
            <span>{{ detail.username }}</span>
          </div>
          <div class="field">
            <span class="muted">{{ t('name') }}</span>
            <span>{{ detail.user_name || '—' }}</span>
          </div>
          <div class="field">
            <span class="muted">{{ t('questionCount') }}</span>
            <span>{{ detail.total_questions }}</span>
          </div>
          <div class="field">
            <span class="muted">{{ t('correct') }}</span>
            <span>{{ detail.correct_count }}</span>
          </div>
          <div class="field">
            <span class="muted">{{ t('wrong') }}</span>
            <span>{{ detail.wrong_count }}</span>
          </div>
          <div class="field">
            <span class="muted">{{ t('score') }}</span>
            <span>{{ detail.total_score }}</span>
          </div>
          <div class="field">
            <span class="muted">{{ t('accuracy') }}</span>
            <span>{{ accuracy(detail) }}%</span>
          </div>
          <div class="field">
            <span class="muted">{{ t('duration') }}</span>
            <span>{{ formatDuration(detail.duration_seconds) }}</span>
          </div>
          <div class="field">
            <span class="muted">{{ t('submittedAt') }}</span>
            <span>{{ formatTime(detail.submitted_at) }}</span>
          </div>
        </div>

        <div class="table-wrap" style="margin-top:14px">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{{ t('title') }}</th>
                <th>{{ t('correct') }}</th>
                <th>{{ t('detail') }}</th>
                <th>{{ t('score') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="answer in answers.list" :key="answer.id">
                <td>{{ answer.question_id }}</td>
                <td class="wrap">{{ answer.title }}</td>
                <td>{{ answer.is_correct ? '✓' : '✗' }}</td>
                <td>{{ optionsText(answer) }}</td>
                <td>{{ answer.score }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!answers.list.length" class="muted">{{ t('empty') }}</p>

        <Pagination
          style="margin-top: 12px"
          :page="answers.page"
          :page-size="answers.pageSize"
          :total="answers.total"
          :total-pages="answers.totalPages"
          :loading="detailLoading"
          @page="changeAnswersPage"
          @size="changeAnswersSize"
        />
      </template>

      <template #footer>
        <button class="btn ghost" type="button" @click="detailOpen = false">{{ t('close') }}</button>
      </template>
    </AppModal>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { request, qs } from '../../api/client.js';
import { usePagedTable } from '../../composables/usePagedTable.js';
import Pagination from '../../components/Pagination.vue';
import AppModal from '../../components/AppModal.vue';
import { state as i18nState, t } from '../../i18n/index.js';

const { rows, total, totalPages, loading, error, query, page, size, changePage, changePageSize, reset } =
  usePagedTable('/admin/records', { filters: { keyword: '', dateFrom: '', dateTo: '' } });

/** 正确率按题数算；题数为 0 时返回 0，避免 NaN 进到进度条宽度。 */
function accuracy(row) {
  const questions = Number(row?.total_questions) || 0;
  if (!questions) return 0;
  return Math.round(((Number(row.correct_count) || 0) / questions) * 100);
}

/** 秒 → `Xm Ys`。 */
function formatDuration(seconds) {
  const value = Number(seconds) || 0;
  return `${Math.floor(value / 60)}m ${value % 60}s`;
}

/** MySQL DATETIME 经 JSON 变成 ISO 串，按本地时间裁成 `YYYY-MM-DD HH:mm`。 */
function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** selected_option_ids 是逗号串（也可能是数组或 JSON），统一成展示文本，缺失时回落填空答案。 */
function optionsText(answer) {
  const raw = answer?.selected_option_ids;
  if (raw === null || raw === undefined || raw === '') return answer?.answer_text || '';
  if (Array.isArray(raw)) return raw.join(', ');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.join(', ') : String(parsed);
  } catch {
    return String(raw);
  }
}

// ---- 详情弹框 ----
const detailOpen = ref(false);
const detailLoading = ref(false);
const detailError = ref('');
const detail = ref(null);

/**
 * 作答明细分页。
 *
 * 没用 `usePagedTable`：那个组合式要求列表就在响应顶层，而这里分页的
 * `answers` 嵌在成绩记录里，头部那几项统计要与它同一次请求取回。
 * 翻页就重拉整个信封 —— 统计字段各页相同，多传几十字节换一份简单代码。
 */
const answers = reactive({ list: [], total: 0, page: 1, pageSize: 10, totalPages: 1 });

async function loadDetail(id) {
  detailLoading.value = true;
  detailError.value = '';
  try {
    const params = { page: answers.page, pageSize: answers.pageSize, lang: i18nState.lang };
    const data = await request(`/admin/records/${id}${qs(params)}`);
    detail.value = data;
    const envelope = data.answers ?? {};
    answers.list = envelope.list ?? [];
    answers.total = envelope.total ?? 0;
    answers.totalPages = envelope.totalPages ?? 1;
  } catch (err) {
    detailError.value = err.message;
  } finally {
    detailLoading.value = false;
  }
}

async function openDetail(row) {
  detail.value = null;
  detailError.value = '';
  detailOpen.value = true;
  answers.page = 1;
  answers.pageSize = 10;
  await loadDetail(row.id);
}

function changeAnswersPage(next) {
  answers.page = Math.max(1, Math.min(next, answers.totalPages || 1));
  return loadDetail(detail.value.id);
}

function changeAnswersSize(next) {
  answers.pageSize = Number(next) || 10;
  answers.page = 1;
  return loadDetail(detail.value.id);
}
</script>
