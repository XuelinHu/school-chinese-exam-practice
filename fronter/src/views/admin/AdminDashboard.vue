<template>
  <section class="admin-panel">
    <p v-if="error" class="alert error">{{ error }}</p>
    <p v-else-if="loading" class="muted">{{ t('loading') }}</p>

    <div class="stat-grid">
      <div v-for="card in cards" :key="card.key" class="stat-card">
        <p class="k">{{ t(card.key) }}</p>
        <p class="v">{{ card.value }}</p>
      </div>
    </div>

    <!-- 近 7 日趋势：没有图表库，柱高按当日记录数占最大值的比例给 px -->
    <div class="card" style="margin-top: 12px">
      <h3>{{ t('trend') }}</h3>
      <p v-if="!trend.length" class="muted">{{ t('empty') }}</p>
      <div v-else class="trend">
        <div
          v-for="item in trend"
          :key="item.day"
          class="trend-col"
          :title="`${dayLabel(item.day)} × ${item.records}`"
        >
          <i :style="{ height: `${trendHeight(item.records)}px` }"></i>
          <span>{{ dayLabel(item.day) }}</span>
        </div>
      </div>
    </div>

    <!-- 各等级表现：条宽按记录数占最大值的比例，右侧显示平均分 -->
    <div class="card" style="margin-top: 12px">
      <h3>{{ t('byLevel') }}</h3>
      <p v-if="!byLevel.length" class="muted">{{ t('empty') }}</p>
      <div v-else class="bars">
        <div v-for="item in byLevel" :key="item.code" class="bar-row">
          <span>{{ item.name || item.code }}</span>
          <div class="bar"><i :style="{ width: barWidth(item.records, maxLevelRecords) }"></i></div>
          <span class="muted">{{ item.avg_score ?? 0 }}</span>
        </div>
      </div>
    </div>

    <!-- 高频错题 -->
    <div class="card" style="margin-top: 12px">
      <h3>{{ t('topWrong') }}</h3>
      <p v-if="!topWrong.length" class="muted">{{ t('empty') }}</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>{{ t('title') }}</th>
              <th>{{ t('questionType') }}</th>
              <th>{{ t('difficulty') }}</th>
              <th>{{ t('wrong') }}</th>
              <th>{{ t('correct') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in topWrong" :key="item.question_id">
              <td>{{ item.question_id }}</td>
              <td class="wrap" :title="item.title">{{ truncate(item.title) }}</td>
              <td>{{ label(item.question_type) }}</td>
              <td>{{ label(item.difficulty) }}</td>
              <td>{{ item.wrong_times }}</td>
              <td>{{ item.resolved_times ?? 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 最近答题 -->
    <div class="card" style="margin-top: 12px">
      <h3>{{ t('recentRecords') }}</h3>
      <p v-if="!recentRecords.length" class="muted">{{ t('empty') }}</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>{{ t('username') }}</th>
              <th>{{ t('totalScore') }}</th>
              <th>{{ t('correct') }}</th>
              <th>{{ t('questionCount') }}</th>
              <th>{{ t('submittedAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in recentRecords" :key="item.id">
              <td>{{ item.id }}</td>
              <td>{{ item.user_name || item.username }}</td>
              <td>{{ item.total_score }}</td>
              <td>{{ item.correct_count }}</td>
              <td>{{ item.total_questions }}</td>
              <td>{{ fmtTime(item.submitted_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { request } from '../../api/client.js';
import { t, label } from '../../i18n/index.js';

const loading = ref(true);
const error = ref('');
const totals = ref({});
const trend = ref([]);
const byLevel = ref([]);
const topWrong = ref([]);
const recentRecords = ref([]);

const TREND_BAR_MAX = 80; // 柱高上限(px)，给下面的日期文字留出空间

const pad = (n) => String(n).padStart(2, '0');

/**
 * 时间列 JSON 化后是 ISO(UTC) 串，按浏览器本地时区显示；
 * 解析失败就退回字符串裁剪，别让看板整块空白。
 */
function dayLabel(day) {
  const date = new Date(day);
  if (Number.isNaN(date.getTime())) return String(day ?? '').slice(5);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fmtTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function truncate(value, max = 40) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const cards = computed(() => [
  { key: 'totalStudents', value: totals.value.students ?? 0 },
  { key: 'online', value: totals.value.online ?? 0 },
  { key: 'totalQuestions', value: totals.value.questions ?? 0 },
  { key: 'totalPapers', value: totals.value.papers ?? 0 },
  { key: 'totalRecords', value: totals.value.records ?? 0 },
  { key: 'accuracy', value: `${totals.value.accuracy ?? 0}%` }
]);

const maxTrend = computed(() => Math.max(1, ...trend.value.map((item) => Number(item.records) || 0)));
const maxLevelRecords = computed(() => Math.max(1, ...byLevel.value.map((item) => Number(item.records) || 0)));

function trendHeight(records) {
  return Math.max(3, Math.round(((Number(records) || 0) / maxTrend.value) * TREND_BAR_MAX));
}

function barWidth(value, max) {
  return `${Math.round(((Number(value) || 0) / (max || 1)) * 100)}%`;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await request('/admin/stats');
    totals.value = data?.totals ?? {};
    trend.value = data?.trend ?? [];
    byLevel.value = data?.byLevel ?? [];
    topWrong.value = data?.topWrongQuestions ?? [];
    recentRecords.value = data?.recentRecords ?? [];
  } catch (err) {
    error.value = err.message || t('empty');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
