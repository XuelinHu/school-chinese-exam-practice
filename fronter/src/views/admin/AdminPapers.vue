<template>
  <section class="admin-panel stack">
    <!-- 工具栏 -->
    <div class="row">
      <button class="btn" type="button" @click="openCreate">{{ t('create') }}</button>
    </div>

    <!-- 筛选栏 -->
    <div class="filters">
      <label class="grow">
        {{ t('search') }}
        <input v-model="query.keyword" type="search" />
      </label>
      <label>
        {{ t('paperType') }}
        <select v-model="query.paperType">
          <option value="">{{ t('all') }}</option>
          <option v-for="type in PAPER_TYPES" :key="type" :value="type">{{ label(type) }}</option>
        </select>
      </label>
      <label>
        {{ t('level') }}
        <select v-model="query.levelId">
          <option value="">{{ t('all') }}</option>
          <option v-for="item in levelOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <label>
        {{ t('status') }}
        <select v-model="query.status">
          <option value="">{{ t('all') }}</option>
          <option v-for="item in STATUSES" :key="item" :value="item">{{ label(item) }}</option>
        </select>
      </label>
      <label>
        {{ t('sortOrder') }}
        <select v-model="query.sort">
          <option value="id">{{ label('id') }}</option>
          <option value="score">{{ t('totalScore') }}</option>
        </select>
      </label>
      <button class="btn ghost" type="button" @click="resetFilters()">{{ t('reset') }}</button>
    </div>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="notice" class="alert success">{{ notice }}</div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ label('id') }}</th>
            <th>{{ t('title') }}</th>
            <th>{{ t('paperType') }}</th>
            <th>{{ t('level') }}</th>
            <th>{{ t('questionCount') }}</th>
            <th>{{ t('recordCount') }}</th>
            <th>{{ t('totalScore') }}</th>
            <th>{{ t('durationMinutes') }}</th>
            <th>{{ t('status') }}</th>
            <th>{{ t('actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.id }}</td>
            <td class="wrap">{{ row.title }}</td>
            <td>{{ label(row.paper_type) }}</td>
            <td>{{ row.level_name }}</td>
            <td>{{ row.question_count }}</td>
            <td>{{ row.record_count }}</td>
            <td>{{ row.total_score }}</td>
            <td>{{ row.duration_minutes }}</td>
            <td><span class="pill">{{ label(row.status) }}</span></td>
            <td>
              <div class="row-actions">
                <button class="btn ghost btn-sm" type="button" @click="openEdit(row)">{{ t('edit') }}</button>
                <button class="btn ghost btn-sm" type="button" @click="openComposer(row)">{{ t('groupQuestions') }}</button>
                <button class="btn ghost danger btn-sm" type="button" @click="remove(row)">{{ t('delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="loading" class="muted">{{ t('loading') }}</p>
    <p v-else-if="!rows.length" class="muted">{{ t('empty') }}</p>

    <Pagination
      :page="page"
      :page-size="size"
      :total="total"
      :total-pages="totalPages"
      :loading="loading"
      @page="changePage"
      @size="changePageSize"
    />

    <!-- 试卷信息 -->
    <AppModal v-model="modalOpen" :title="editing ? t('edit') : t('create')" size="lg">
      <div class="stack">
        <div v-if="formError" class="alert error">{{ formError }}</div>

        <div class="form-grid">
          <label>
            {{ t('paperType') }}
            <select v-model="form.paperType">
              <option v-for="type in PAPER_TYPES" :key="type" :value="type">{{ label(type) }}</option>
            </select>
          </label>
          <label>
            {{ t('level') }}
            <select v-model="form.levelId">
              <option value="">{{ t('empty') }}</option>
              <option v-for="item in levelOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
          <label>
            {{ t('durationMinutes') }}
            <input v-model.number="form.durationMinutes" type="number" min="0" />
          </label>
          <label>
            {{ t('status') }}
            <select v-model="form.status">
              <option v-for="item in STATUSES" :key="item" :value="item">{{ label(item) }}</option>
            </select>
          </label>
        </div>

        <!-- 三语内容：切 Tab 只切编辑区，提交时三个语言一起带上 -->
        <div>
          <p class="hint">{{ t('translations') }} · {{ activeLangLabel }}</p>
          <div class="lang-tabs">
            <button
              v-for="lang in LANGUAGES"
              :key="lang.code"
              type="button"
              :class="{ active: activeLang === lang.code }"
              @click="activeLang = lang.code"
            >
              {{ lang.label }}
            </button>
          </div>
          <div class="form-grid">
            <label class="field full">
              {{ t('title') }}
              <input v-model="form.translations[activeLang].title" type="text" />
            </label>
            <label class="field full">
              {{ t('description') }}
              <textarea v-model="form.translations[activeLang].description" rows="3"></textarea>
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <button class="btn ghost" type="button" @click="modalOpen = false">{{ t('cancel') }}</button>
        <button class="btn" type="button" :disabled="saving" @click="submit">{{ t('save') }}</button>
      </template>
    </AppModal>

    <!-- 组卷：左挑题、右排序给分，提交时按数组下标重写 sortOrder -->
    <AppModal v-model="composerOpen" :title="t('groupQuestions')" size="xl">
      <div class="stack">
        <div v-if="composerError" class="alert error">{{ composerError }}</div>

        <div class="composer">
          <!-- 候选题 -->
          <div class="stack">
            <p class="hint">{{ t('questions') }} · {{ picker.rows.length }}</p>
            <div class="filters">
              <label class="grow">
                {{ t('search') }}
                <input v-model="picker.keyword" type="search" @keyup.enter="loadPicker()" />
              </label>
              <button class="btn ghost" type="button" @click="loadPicker()">{{ t('search') }}</button>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{{ label('id') }}</th>
                    <th>{{ t('title') }}</th>
                    <th>{{ t('questionType') }}</th>
                    <th>{{ t('difficulty') }}</th>
                    <th>{{ t('score') }}</th>
                    <th>{{ t('actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in picker.rows" :key="row.id">
                    <td>{{ row.id }}</td>
                    <td class="wrap">{{ row.title }}</td>
                    <td>{{ label(row.question_type) }}</td>
                    <td>{{ label(row.difficulty) }}</td>
                    <td>{{ row.score }}</td>
                    <td>
                      <button
                        class="btn ghost btn-sm"
                        type="button"
                        :disabled="isPicked(row.id)"
                        @click="addQuestion(row)"
                      >
                        {{ t('create') }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="picker.loading" class="muted">{{ t('loading') }}</p>
            <p v-else-if="!picker.rows.length" class="muted">{{ t('empty') }}</p>
          </div>

          <!-- 已选题与分值 -->
          <div class="stack">
            <p class="hint">
              {{ t('groupQuestions') }} · {{ composerItems.length }} · {{ t('totalScore') }} {{ composerTotal }}
            </p>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{{ t('sortOrder') }}</th>
                    <th>{{ t('title') }}</th>
                    <th>{{ t('score') }}</th>
                    <th>{{ t('actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in composerItems" :key="item.question_id">
                    <td>{{ index + 1 }}</td>
                    <td class="wrap">{{ item.title }}</td>
                    <td>
                      <input v-model.number="item.score" class="score-input" type="number" min="0" step="0.5" />
                    </td>
                    <td>
                      <div class="row-actions">
                        <button
                          class="btn ghost btn-sm"
                          type="button"
                          :disabled="index === 0"
                          @click="move(index, -1)"
                        >
                          ↑
                        </button>
                        <button
                          class="btn ghost btn-sm"
                          type="button"
                          :disabled="index === composerItems.length - 1"
                          @click="move(index, 1)"
                        >
                          ↓
                        </button>
                        <button class="btn ghost danger btn-sm" type="button" @click="removeItem(index)">
                          {{ t('delete') }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="!composerItems.length" class="muted">{{ t('empty') }}</p>
            <div class="row">
              <span class="pill">{{ t('totalScore') }}: {{ composerTotal }}</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <span class="muted">{{ t('totalScore') }}: {{ composerTotal }}</span>
        <button class="btn ghost" type="button" @click="composerOpen = false">{{ t('cancel') }}</button>
        <button class="btn" type="button" :disabled="composerSaving" @click="submitComposer">{{ t('save') }}</button>
      </template>
    </AppModal>
  </section>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { request, qs } from '../../api/client.js';
import { usePagedTable } from '../../composables/usePagedTable.js';
import Pagination from '../../components/Pagination.vue';
import AppModal from '../../components/AppModal.vue';
import { t, label, LANGUAGES, state as i18nState } from '../../i18n/index.js';

/** 与后端 adminContent.js 的白名单保持一致。 */
const PAPER_TYPES = ['practice', 'exam', 'daily'];
const STATUSES = ['published', 'draft', 'disabled'];

/** 试卷三语字段，与 paper_translations 的列一一对应。 */
const FIELDS = ['title', 'description'];

const {
  rows, total, totalPages, loading, error, query, page, size,
  load, reset, changePage, changePageSize
} = usePagedTable('/admin/papers', {
  filters: { keyword: '', paperType: '', levelId: '', status: '', sort: 'id', lang: i18nState.lang }
});

const levelOptions = ref([]);
const modalOpen = ref(false);
const saving = ref(false);
const editing = ref(false);
const activeLang = ref('zh-CN');
const formError = ref('');
const notice = ref('');
let noticeTimer = null;

const composerOpen = ref(false);
const composerSaving = ref(false);
const composerError = ref('');
const composerPaper = ref(null);
const composerItems = ref([]);
const picker = reactive({ keyword: '', loading: false, rows: [] });

const form = reactive({
  id: null,
  paperType: 'practice',
  levelId: '',
  durationMinutes: 60,
  status: 'published',
  translations: blankTranslations(FIELDS)
});

const activeLangLabel = computed(
  () => LANGUAGES.find((item) => item.code === activeLang.value)?.label ?? activeLang.value
);

/** 组卷实时总分，与后端按分值求和的口径一致。 */
const composerTotal = computed(() => {
  const sum = composerItems.value.reduce((acc, item) => acc + (Number(item.score) || 0), 0);
  return Math.round(sum * 100) / 100;
});

/** 三语空壳：三个语言分支始终存在，后端只 upsert 有内容的分支。 */
function blankTranslations(fields) {
  return Object.fromEntries(
    LANGUAGES.map(({ code }) => [code, Object.fromEntries(fields.map((field) => [field, '']))])
  );
}

/** 把接口返回的译文合并进空壳，避免只改中文时清掉英文 / 马来文。 */
function mergeTranslations(fields, loaded) {
  const merged = blankTranslations(fields);
  for (const { code } of LANGUAGES) {
    for (const field of fields) {
      const value = loaded?.[code]?.[field];
      if (value !== undefined && value !== null) merged[code][field] = value;
    }
  }
  return merged;
}

async function loadLevels() {
  try {
    const data = await request(`/admin/levels${qs({ pageSize: 100, lang: i18nState.lang })}`);
    levelOptions.value = data?.list ?? [];
  } catch {
    levelOptions.value = [];
  }
}

/** 列表展示语言跟随界面语言，只影响读取，不影响落库内容。 */
watch(() => i18nState.lang, (lang) => {
  if (query.lang !== lang) query.lang = lang;
});
watch(() => i18nState.lang, loadLevels);

onMounted(loadLevels);

function flash(text) {
  notice.value = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.value = ''; }, 3000);
}

/** 重置筛选时顺带把展示语言拉回当前界面语言（reset 会还原成进入页面时的值）。 */
function resetFilters() {
  reset();
  query.lang = i18nState.lang;
}

function resetForm() {
  Object.assign(form, {
    id: null,
    paperType: 'practice',
    levelId: '',
    durationMinutes: 60,
    status: 'published',
    translations: blankTranslations(FIELDS)
  });
  formError.value = '';
  activeLang.value = i18nState.lang;
}

async function openCreate() {
  await loadLevels();
  resetForm();
  editing.value = false;
  modalOpen.value = true;
}

async function openEdit(row) {
  await loadLevels();
  resetForm();
  editing.value = true;
  modalOpen.value = true;
  try {
    const data = await request(`/admin/papers/${row.id}${qs({ lang: i18nState.lang })}`);
    Object.assign(form, {
      id: data.id,
      paperType: data.paper_type ?? 'practice',
      levelId: data.level_id ?? '',
      durationMinutes: data.duration_minutes ?? 0,
      status: data.status ?? 'published',
      translations: mergeTranslations(FIELDS, data.translations)
    });
  } catch (err) {
    formError.value = err.message;
  }
}

async function submit() {
  formError.value = '';
  // 提交整份 translations（含全部三种语言），后端按语言 upsert，空的分支自动跳过
  const body = {
    paperType: form.paperType,
    levelId: form.levelId ? Number(form.levelId) : null,
    durationMinutes: Number(form.durationMinutes) || 0,
    status: form.status,
    translations: form.translations
  };

  saving.value = true;
  try {
    if (editing.value) await request(`/admin/papers/${form.id}`, { method: 'PUT', body });
    else await request('/admin/papers', { method: 'POST', body });
    modalOpen.value = false;
    flash(t('saved'));
    await load();
  } catch (err) {
    formError.value = err.message;
  } finally {
    saving.value = false;
  }
}

async function remove(row) {
  if (!window.confirm(t('deleteConfirm'))) return;
  error.value = '';
  try {
    await request(`/admin/papers/${row.id}`, { method: 'DELETE' });
    flash(t('deleted'));
    await load();
  } catch (err) {
    // 409：已有成绩记录引用该试卷
    error.value = err.message;
  }
}

// ---------------------------------------------------------------- 组卷

/** 候选题只取已发布题目，避免把草稿组进试卷。 */
async function loadPicker() {
  picker.loading = true;
  composerError.value = '';
  try {
    const data = await request(
      `/admin/questions${qs({ pageSize: 100, status: 'published', keyword: picker.keyword, lang: i18nState.lang })}`
    );
    picker.rows = data?.list ?? [];
  } catch (err) {
    composerError.value = err.message;
    picker.rows = [];
  } finally {
    picker.loading = false;
  }
}

async function openComposer(row) {
  composerPaper.value = row;
  composerError.value = '';
  picker.keyword = '';
  composerItems.value = [];
  composerOpen.value = true;
  try {
    const data = await request(`/admin/papers/${row.id}${qs({ lang: i18nState.lang })}`);
    composerItems.value = (data.questions ?? []).map((item) => ({
      question_id: item.question_id,
      title: item.title,
      question_type: item.question_type,
      difficulty: item.difficulty,
      score: Number(item.score)
    }));
  } catch (err) {
    composerError.value = err.message;
  }
  await loadPicker();
}

function isPicked(id) {
  return composerItems.value.some((item) => item.question_id === id);
}

function addQuestion(row) {
  if (isPicked(row.id)) return;
  composerItems.value.push({
    question_id: row.id,
    title: row.title,
    question_type: row.question_type,
    difficulty: row.difficulty,
    score: Number(row.score) || 1
  });
}

/** 上下移只调数组顺序，sortOrder 提交时按下标重新生成。 */
function move(index, delta) {
  const target = index + delta;
  const items = composerItems.value;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
}

function removeItem(index) {
  composerItems.value.splice(index, 1);
}

async function submitComposer() {
  composerError.value = '';
  if (!composerItems.value.length) {
    composerError.value = `${label('error')} · ${t('questionCount')}`;
    return;
  }

  composerSaving.value = true;
  try {
    await request(`/admin/papers/${composerPaper.value.id}/questions`, {
      method: 'PUT',
      body: {
        questions: composerItems.value.map((item, index) => ({
          questionId: item.question_id,
          score: Number(item.score) || 0,
          sortOrder: index
        }))
      }
    });
    composerOpen.value = false;
    flash(t('saved'));
    await load();
  } catch (err) {
    composerError.value = err.message;
  } finally {
    composerSaving.value = false;
  }
}
</script>

<style scoped>
/* 现有样式表没有纵向间距工具类，这里补一层面板内部的堆叠布局 */
.stack { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }

/* 组卷弹框：候选题目 / 已选题目两栏，窄屏自动堆叠 */
.composer { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.composer > * { min-width: 0; }

/* 表格里的分值输入不该铺满整格 */
.score-input { width: 92px; border: 1px solid #ccd4df; border-radius: 6px; padding: 6px 8px; }
</style>
