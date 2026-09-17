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
        {{ t('level') }}
        <select v-model="query.levelId">
          <option value="">{{ t('all') }}</option>
          <option v-for="item in levelOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <label>
        {{ t('category') }}
        <select v-model="query.categoryId">
          <option value="">{{ t('all') }}</option>
          <option v-for="item in categoryOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <label>
        {{ t('questionType') }}
        <select v-model="query.questionType">
          <option value="">{{ t('all') }}</option>
          <option v-for="type in QUESTION_TYPES" :key="type" :value="type">{{ label(type) }}</option>
        </select>
      </label>
      <label>
        {{ t('difficulty') }}
        <select v-model="query.difficulty">
          <option value="">{{ t('all') }}</option>
          <option v-for="item in DIFFICULTIES" :key="item" :value="item">{{ label(item) }}</option>
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
          <option value="score">{{ t('score') }}</option>
          <option value="difficulty">{{ t('difficulty') }}</option>
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
            <th>{{ t('level') }}</th>
            <th>{{ t('category') }}</th>
            <th>{{ t('questionType') }}</th>
            <th>{{ t('difficulty') }}</th>
            <th>{{ t('score') }}</th>
            <th>{{ t('answerCount') }}</th>
            <th>{{ t('status') }}</th>
            <th>{{ t('createdAt') }}</th>
            <th>{{ t('actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.id }}</td>
            <td class="wrap">{{ row.title }}</td>
            <td>{{ row.level_name }}</td>
            <td>{{ row.category_name }}</td>
            <td>{{ label(row.question_type) }}</td>
            <td>{{ label(row.difficulty) }}</td>
            <td>{{ row.score }}</td>
            <td>{{ row.option_count }}</td>
            <td><span class="pill">{{ label(row.status) }}</span></td>
            <td>{{ row.updated_at }}</td>
            <td>
              <div class="row-actions">
                <button class="btn ghost btn-sm" type="button" @click="openEdit(row)">{{ t('edit') }}</button>
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

    <AppModal v-model="modalOpen" :title="editing ? t('edit') : t('create')" size="xl">
      <div class="stack">
        <div v-if="formError" class="alert error">{{ formError }}</div>

        <!-- 标量字段 -->
        <div class="form-grid">
          <label>
            {{ t('level') }}
            <select v-model="form.levelId">
              <option v-for="item in levelOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
          <label>
            {{ t('category') }}
            <select v-model="form.categoryId">
              <option v-for="item in categoryOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
          <label>
            {{ t('questionType') }}
            <select v-model="form.questionType">
              <option v-for="type in QUESTION_TYPES" :key="type" :value="type">{{ label(type) }}</option>
            </select>
          </label>
          <label>
            {{ t('difficulty') }}
            <select v-model="form.difficulty">
              <option v-for="item in DIFFICULTIES" :key="item" :value="item">{{ label(item) }}</option>
            </select>
          </label>
          <label>
            {{ t('score') }}
            <input v-model.number="form.score" type="number" min="0" step="0.5" />
          </label>
          <label>
            {{ t('status') }}
            <select v-model="form.status">
              <option v-for="item in STATUSES" :key="item" :value="item">{{ label(item) }}</option>
            </select>
          </label>
        </div>

        <!-- 三语题干：切 Tab 只切编辑区，提交时三个语言一起带上 -->
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
              {{ t('content') }}
              <textarea v-model="form.translations[activeLang].content" rows="3"></textarea>
            </label>
            <label class="field full">
              {{ t('analysis') }}
              <textarea v-model="form.translations[activeLang].analysis" rows="3"></textarea>
            </label>
          </div>
        </div>

        <!-- 选项：内容跟随上方语言 Tab -->
        <div class="stack">
          <p class="hint">{{ t('answerCount') }} · {{ form.options.length }} · {{ activeLangLabel }}</p>
          <div v-for="(option, index) in form.options" :key="option.uid" class="card stack">
            <div class="form-grid">
              <label>
                {{ t('optionKey') }}
                <input :value="option.optionKey" type="text" maxlength="10" @input="onKeyInput(option, $event)" />
              </label>
              <label class="field full">
                {{ t('content') }} · {{ activeLangLabel }}
                <input v-model="option.translations[activeLang].content" type="text" />
              </label>
            </div>
            <div class="row">
              <label class="row">
                <input v-model="option.isCorrect" type="checkbox" />
                {{ t('isCorrect') }}
              </label>
              <button class="btn ghost danger btn-sm" type="button" @click="removeOption(index)">
                {{ t('delete') }}
              </button>
            </div>
          </div>
          <div class="row">
            <button class="btn ghost btn-sm" type="button" @click="addOption()">{{ t('create') }}</button>
          </div>
        </div>
      </div>

      <template #footer>
        <button class="btn ghost" type="button" @click="modalOpen = false">{{ t('cancel') }}</button>
        <button class="btn" type="button" :disabled="saving" @click="submit">{{ t('save') }}</button>
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

/** 与后端 adminContent.js 的白名单保持一致，避免下拉出现非法值。 */
const QUESTION_TYPES = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
const DIFFICULTIES = ['easy', 'normal', 'hard'];
const STATUSES = ['published', 'draft', 'disabled'];

/** 题干三语字段；选项只有 content 一个三语字段。 */
const FIELDS = ['title', 'content', 'analysis'];
const OPTION_FIELDS = ['content'];

const {
  rows, total, totalPages, loading, error, query, page, size,
  load, reset, changePage, changePageSize
} = usePagedTable('/admin/questions', {
  filters: {
    keyword: '', levelId: '', categoryId: '', questionType: '',
    difficulty: '', status: '', sort: 'id', lang: i18nState.lang
  }
});

const levelOptions = ref([]);
const categoryOptions = ref([]);
const modalOpen = ref(false);
const saving = ref(false);
const editing = ref(false);
const activeLang = ref('zh-CN');
const formError = ref('');
const notice = ref('');
let noticeTimer = null;
let optionSeq = 0;

const form = reactive({
  id: null,
  levelId: '',
  categoryId: '',
  questionType: 'single_choice',
  difficulty: 'easy',
  score: 1,
  status: 'published',
  translations: blankTranslations(FIELDS),
  options: [blankOption('A', true), blankOption('B')]
});

const activeLangLabel = computed(
  () => LANGUAGES.find((item) => item.code === activeLang.value)?.label ?? activeLang.value
);

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

/** 选项行需要稳定 key，uid 只用于渲染，提交时不带上。 */
function blankOption(key, isCorrect = false) {
  optionSeq += 1;
  return { uid: optionSeq, optionKey: key, isCorrect, translations: blankTranslations(OPTION_FIELDS) };
}

/** 新选项的默认 key：A、B、C…超过 26 个退化成序号（后端只收 A-Z0-9）。 */
function nextKey(index) {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

/** optionKey 只允许 A-Z0-9，输入时即时规整，省得提交被后端打回。 */
function onKeyInput(option, event) {
  option.optionKey = String(event.target.value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

function addOption() {
  form.options.push(blankOption(nextKey(form.options.length)));
}

function removeOption(index) {
  form.options.splice(index, 1);
}

async function loadOptions() {
  try {
    const [levels, categories] = await Promise.all([
      request(`/admin/levels${qs({ pageSize: 100, lang: i18nState.lang })}`),
      request(`/admin/categories${qs({ pageSize: 100, lang: i18nState.lang })}`)
    ]);
    levelOptions.value = levels?.list ?? [];
    categoryOptions.value = categories?.list ?? [];
  } catch {
    // 下拉数据失败不阻塞列表，留空即可
  }
}

/** 列表展示语言跟随界面语言，只影响读取，不影响落库内容。 */
watch(() => i18nState.lang, (lang) => {
  if (query.lang !== lang) query.lang = lang;
});
watch(() => i18nState.lang, loadOptions);

onMounted(loadOptions);

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
    levelId: levelOptions.value[0]?.id ?? '',
    categoryId: categoryOptions.value[0]?.id ?? '',
    questionType: 'single_choice',
    difficulty: 'easy',
    score: 1,
    status: 'published',
    translations: blankTranslations(FIELDS),
    options: [blankOption('A', true), blankOption('B')]
  });
  formError.value = '';
  activeLang.value = i18nState.lang;
}

async function openCreate() {
  await loadOptions();
  resetForm();
  editing.value = false;
  modalOpen.value = true;
}

async function openEdit(row) {
  await loadOptions();
  resetForm();
  editing.value = true;
  modalOpen.value = true;
  try {
    const data = await request(`/admin/questions/${row.id}`);
    Object.assign(form, {
      id: data.id,
      levelId: data.level_id ?? '',
      categoryId: data.category_id ?? '',
      questionType: data.question_type ?? 'single_choice',
      difficulty: data.difficulty ?? 'easy',
      score: data.score ?? 1,
      status: data.status ?? 'published',
      translations: mergeTranslations(FIELDS, data.translations),
      // 选项整体回填：提交时整份送回去，后端按 optionKey 匹配才不会被删
      options: (data.options ?? []).map((option) => {
        const item = blankOption(option.option_key);
        item.isCorrect = Boolean(option.is_correct);
        item.translations = mergeTranslations(OPTION_FIELDS, option.translations);
        return item;
      })
    });
    if (!form.options.length) form.options = [blankOption('A', true)];
  } catch (err) {
    formError.value = err.message;
  }
}

/** 提交前校验：等级/分类必选、中文题干非空、至少一个选项且至少一个正确项。 */
function validate() {
  const missing = [];
  if (!form.levelId) missing.push(t('level'));
  if (!form.categoryId) missing.push(t('category'));
  if (!form.translations['zh-CN'].title.trim()) missing.push(t('title'));
  if (!form.options.length) missing.push(t('answerCount'));
  else if (!form.options.some((option) => option.isCorrect)) missing.push(t('isCorrect'));
  return missing;
}

async function submit() {
  formError.value = '';
  const missing = validate();
  if (missing.length) {
    formError.value = `${label('error')} · ${missing.join(' · ')}`;
    return;
  }

  // 提交整份 translations（含全部三种语言）与全部选项，空的语言分支由后端跳过
  const body = {
    levelId: Number(form.levelId),
    categoryId: Number(form.categoryId),
    questionType: form.questionType,
    difficulty: form.difficulty,
    score: Number(form.score) || 0,
    status: form.status,
    translations: form.translations,
    options: form.options.map((option, index) => ({
      optionKey: option.optionKey || nextKey(index),
      isCorrect: option.isCorrect,
      sortOrder: index,
      translations: option.translations
    }))
  };

  saving.value = true;
  try {
    if (editing.value) await request(`/admin/questions/${form.id}`, { method: 'PUT', body });
    else await request('/admin/questions', { method: 'POST', body });
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
    await request(`/admin/questions/${row.id}`, { method: 'DELETE' });
    flash(t('deleted'));
    await load();
  } catch (err) {
    error.value = err.message;
  }
}
</script>

<style scoped>
/* 现有样式表没有纵向间距工具类，这里补一层面板内部的堆叠布局 */
.stack { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
</style>
