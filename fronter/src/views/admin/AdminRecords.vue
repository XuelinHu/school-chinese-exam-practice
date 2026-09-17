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
              <tr v-for="answer in detail.answers" :key="answer.id">
                <td>{{ answer.question_id }}</td>
                <td class="wrap">{{ answer.title }}</td>
                <td>{{ answer.is_correct ? '✓' : '✗' }}</td>
                <td>{{ optionsText(answer) }}</td>
                <td>{{ answer.score }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!(detail.answers || []).length" class="muted">{{ t('empty') }}</p>
      </template>

      <template #footer>
        <button class="btn ghost" type="button" @click="detailOpen = false">{{ t('close') }}</button>
      </template>
    </AppModal>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { request } from '../../api/client.js';
import { usePagedTable } from '../../composables/usePagedTable.js';
import Pagination from '../../components/Pagination.vue';
import AppModal from '../../components/AppModal.vue';
import { t } from '../../i18n/index.js';

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

async function openDetail(row) {
  detail.value = null;
  detailError.value = '';
  detailLoading.value = true;
  detailOpen.value = true;
  try {
    detail.value = await request(`/admin/records/${row.id}`);
  } catch (err) {
    detailError.value = err.message;
  } finally {
    detailLoading.value = false;
  }
}
</script>
