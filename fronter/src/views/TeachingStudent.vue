<template>
  <section>
    <p class="muted">
      <router-link to="/teaching">← {{ t('teaching') }}</router-link>
    </p>

    <h1>{{ student.name || student.username || t('loading') }}</h1>
    <p v-if="loadError" class="alert error">{{ loadError }}</p>

    <div v-if="student.id" class="admin-panel" style="margin-top: 12px">
      <div class="form-grid">
        <div class="field"><span class="muted">{{ t('username') }}</span><span>{{ student.username }}</span></div>
        <div class="field"><span class="muted">{{ t('name') }}</span><span>{{ student.name }}</span></div>
        <div class="field"><span class="muted">{{ t('studentNo') }}</span><span>{{ student.student_no }}</span></div>
        <div class="field"><span class="muted">{{ t('nationality') }}</span><span>{{ student.nationality }}</span></div>
        <div class="field"><span class="muted">{{ t('status') }}</span><span>{{ label(student.status) }}</span></div>
        <div class="field"><span class="muted">{{ t('recordCount') }}</span><span>{{ stats.recordCount ?? 0 }}</span></div>
        <div class="field"><span class="muted">{{ t('avgScore') }}</span><span>{{ stats.avgScore ?? 0 }}</span></div>
        <div class="field"><span class="muted">{{ t('bestScore') }}</span><span>{{ stats.bestScore ?? 0 }}</span></div>
        <div class="field"><span class="muted">{{ t('studyTime') }}</span><span>{{ duration(stats.totalSeconds) }}</span></div>
        <div class="field"><span class="muted">{{ t('wrongBook') }}</span><span>{{ stats.wrongTotal ?? 0 }}</span></div>
        <div class="field"><span class="muted">{{ t('unresolvedWrong') }}</span><span>{{ stats.wrongUnresolved ?? 0 }}</span></div>
      </div>
      <p class="muted" style="margin-top: 10px">{{ t('readOnlyHint') }}</p>
    </div>

    <!-- 成绩记录 -->
    <h2 style="margin-top: 20px">{{ t('records') }}</h2>
    <div class="admin-panel">
      <p v-if="records.error" class="alert error">{{ records.error }}</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('title') }}</th>
              <th>{{ t('questionCount') }}</th>
              <th>{{ t('correct') }}</th>
              <th>{{ t('wrong') }}</th>
              <th>{{ t('score') }}</th>
              <th>{{ t('duration') }}</th>
              <th>{{ t('submittedAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in records.rows" :key="row.id">
              <td>{{ row.paper_title }}</td>
              <td>{{ row.total_questions }}</td>
              <td>{{ row.correct_count }}</td>
              <td>{{ row.wrong_count }}</td>
              <td>{{ row.total_score }}</td>
              <td>{{ duration(row.duration_seconds) }}</td>
              <td>{{ fmtTime(row.submitted_at) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!records.rows.length && !records.loading" class="muted">{{ t('empty') }}</p>
      </div>
      <Pagination
        style="margin-top: 12px"
        :page="records.page"
        :page-size="records.size"
        :total="records.total"
        :total-pages="records.totalPages"
        :loading="records.loading"
        @page="records.changePage"
        @size="records.changePageSize"
      />
    </div>

    <!-- 错题 -->
    <h2 style="margin-top: 20px">{{ t('wrongBook') }}</h2>
    <div class="admin-panel">
      <div class="filters">
        <label>
          {{ t('status') }}
          <select v-model="wrong.query.resolved">
            <option value="">{{ t('all') }}</option>
            <option value="0">{{ t('unresolved') }}</option>
            <option value="1">{{ t('resolved') }}</option>
          </select>
        </label>
      </div>

      <p v-if="wrong.error" class="alert error" style="margin-top: 12px">{{ wrong.error }}</p>

      <div class="table-wrap" style="margin-top: 12px">
        <table>
          <thead>
            <tr>
              <th>{{ t('title') }}</th>
              <th>{{ t('category') }}</th>
              <th>{{ t('level') }}</th>
              <th>{{ t('questionType') }}</th>
              <th>{{ t('difficulty') }}</th>
              <th>{{ t('wrongCount') }}</th>
              <th>{{ t('status') }}</th>
              <th>{{ t('lastWrongAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in wrong.rows" :key="row.id">
              <td class="wrap">{{ row.title }}</td>
              <td>{{ row.category_name }}</td>
              <td>{{ row.level_name }}</td>
              <td>{{ label(row.question_type) }}</td>
              <td>{{ label(row.difficulty) }}</td>
              <td>{{ row.wrong_count }}</td>
              <td><span class="pill">{{ row.resolved ? t('resolved') : t('unresolved') }}</span></td>
              <td>{{ fmtTime(row.last_wrong_at) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!wrong.rows.length && !wrong.loading" class="muted">{{ t('empty') }}</p>
      </div>
      <Pagination
        style="margin-top: 12px"
        :page="wrong.page"
        :page-size="wrong.size"
        :total="wrong.total"
        :total-pages="wrong.totalPages"
        :loading="wrong.loading"
        @page="wrong.changePage"
        @size="wrong.changePageSize"
      />
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { request } from '../api/client.js';
import { usePagedTable } from '../composables/usePagedTable.js';
import Pagination from '../components/Pagination.vue';
import { state, t, label } from '../i18n/index.js';
import { fmtTime, splitDuration } from '../utils/format.js';

const route = useRoute();
const id = Number(route.params.id);

const student = ref({});
const stats = ref({});
const loadError = ref('');

/**
 * 两个列表各自独立分页：翻成绩不该把错题也重置回第一页。
 * `reactive()` 包一层是为了在模板里直接写 `records.rows`，不必到处 `.value`。
 */
const records = reactive(usePagedTable(`/teaching/students/${id}/records`, {
  extra: () => ({ lang: state.lang })
}));
const wrong = reactive(usePagedTable(`/teaching/students/${id}/wrong-questions`, {
  // resolved 属于筛选表单，空值时 qs() 会跳过
  filters: { resolved: '' },
  extra: () => ({ lang: state.lang })
}));

/** 秒数按当前语言拼单位 —— 「分/秒」在三语里写法不同。 */
function duration(seconds) {
  const { minutes, seconds: rest } = splitDuration(seconds);
  return minutes ? `${minutes} ${t('minutes')} ${rest} ${t('seconds')}` : `${rest} ${t('seconds')}`;
}

onMounted(async () => {
  try {
    const data = await request(`/teaching/students/${id}`);
    student.value = data ?? {};
    stats.value = data?.stats ?? {};
  } catch (err) {
    // 学员不存在或已被软删除时后端返回 404，如实展示，不假装是空数据
    loadError.value = err.message || t('empty');
  }
});
</script>
