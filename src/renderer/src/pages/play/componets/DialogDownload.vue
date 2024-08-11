<template>
  <div class="download-warp">
    <div class="source-warp">
      <t-select v-model="downloadSource" :placeholder="$t('pages.player.download.soureceSelect')" size="small"
                style="width: 200px; display: inline-block" @change="downloadSourceChange">
        <t-option v-for="(_, key) in formData.season" :key="key" :value="key">{{ key }}</t-option>
      </t-select>
      <div>
        <t-button size="small" theme="default" @click="startDownload" v-if="selectedRowKeys.length>0">下载选中</t-button>
      </div>
    </div>
    <div class="content-warp">
      <t-table
        row-key="label"
        :columns="columns"
        :data="downloadData"
        :selected-row-keys="selectedRowKeys"
        :select-on-row-click="true"
        lazy-load
        @select-change="reHandleSelectChange"
      >
      </t-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import {useClipboard} from '@vueuse/core';
import {onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {MessagePlugin, Tag, Textarea} from 'tdesign-vue-next';

import {t} from '@/locales';
import {supportedFormats} from '@/utils/tool';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  data: {
    type: Object,
    default: () => {
      return {
        season: {},
        current: '',
        info: null
      };
    },
  },
});
const {isSupported, copy} = useClipboard();
const formVisible = ref(false);
const formData = ref(props.data);

const downloadSource = ref();
const downloadEpisodes = ref([]);

const statusNameListMap = {
  "-2": {label: '未开始', theme: 'success'},
  "-1": {label: '出错', theme: 'success'},
  "0": {label: '完成', theme: 'success'},
  "1": {label: '处理中', theme: 'danger'},
};

const columns = ref([
  {colKey: 'row-select', type: 'multiple', width: 50,},
  {colKey: 'title', title: '标题', width: 150,},
  {colKey: 'label', title: '集数', width: 150,},
  {
    colKey: 'msg', title: '消息',
    cell: (h, {row}) => {
      // 使用 `h` 函数来创建 t-textarea 组件
      return h(
        Textarea,
        {
          modelValue: row.msg,
          'onUpdate:modelValue': (value) => {
            row.msg = value
          },
          //autosize: true
          autosize: {minRows: 5, maxRows: 10}
        }
      );
    },
  },
  {
    colKey: 'status',
    title: '状态',
    cell: (h, {row}) => {
      return h(Tag, {label: statusNameListMap[row.status].label, theme: statusNameListMap[row.status].theme},
        {
          default: () => [
            h('span', {}, statusNameListMap[row.status].label)
          ]
        });
    },
    width: 150,
  },
  // {
  //   colKey: 'progress',
  //   title: '进度',
  //   cell: (h, {row}) => {
  //     return h(Progress, {percentage: row.progress, theme: 'plump'});
  //   },
  //   width: 150,
  // },
]);
let downloadData = ref([]);
const selectedRowKeys = ref([]);

const reHandleSelectChange = (value, ctx) => {
  selectedRowKeys.value = value;
};

const emit = defineEmits(['update:visible']);

watch(
  () => formVisible.value,
  (val) => {
    emit('update:visible', val);
  },
);
watch(
  () => props.visible,
  (val) => {
    formVisible.value = val;
  },
);
watch(
  () => props.data,
  (val) => {
    formData.value = val;
  },
);

// 检查复制的复制
const checkDownloadUrl = (url) => {
  const urlExtension = url.match(/\.([^.]+)$/)?.[1]; // 使用正则表达式提取文件扩展名
  const isValid = urlExtension && supportedFormats.includes(urlExtension); // 检查是否在允许的扩展名列表中

  if (!isValid) MessagePlugin.warning(t('pages.player.download.copyCheck'));
};

// 复制到剪贴板
const copyToClipboard = (content, successMessage, errorMessage) => {
  copy(content);
  if (isSupported) MessagePlugin.info(successMessage);
  else MessagePlugin.warning(errorMessage);
};

// 复制下载地址列表
const downloadSourceChange = () => {
  let title = "未定义";
  let info = formData.value.info;
  if (info["vod_name"]) {
    title = info["vod_name"];
  } else if (info["name"]) {
    title = info["name"];
  }

  title = title.replaceAll(" ", "");

  const list: any = [];
  for (const item of formData.value.season[downloadSource.value]) {
    let [index, url] = item.split('$');
    index = index.replaceAll(" ", "");
    list.push({
      value: url,
      label: index,
      title: title,
      msg: '',
      status: -2,
      // progress: 0,
      disabled: false,
    });
  }
  downloadEpisodes.value = list;
  downloadData.value = list;
};

// 复制下载链接
const copyDownloadUrl = () => {
  if (downloadData.value) {
    const successMessage = t('pages.player.download.copySuccess');
    const errorMessage = t('pages.player.download.copyFail');

    copyToClipboard(downloadData.value, successMessage, errorMessage);
    formVisible.value = false;
  } else {
    MessagePlugin.warning(t('pages.player.download.copyEmpty'));
  }
};

const startDownload = () => {
  let keys = selectedRowKeys.value;
  let sendData = []
  for (let key of keys) {
    for (let v of downloadData.value) {
      if (v.label == key) {
        sendData.push(v);
        break;
      }
    }
  }
  window.electron.ipcRenderer.send('exec-download', JSON.stringify(sendData));
}

// 复制当前播放地址
const copyCurrentUrl = () => {
  const successMessage = t('pages.player.download.copySuccess');
  const errorMessage = t('pages.player.download.copyError');
  copyToClipboard(formData.value.current, successMessage, errorMessage);
  checkDownloadUrl(formData.value.current);

  formVisible.value = false;
};

const init = () => {
  for (let valueKey in formData.value.season) {
    downloadSource.value = valueKey;
    if (downloadSource.value) {
      break;
    }
  }
  downloadSourceChange();
}

const downloadProgressHandler = (event, params) => {
  for (let e of downloadData.value) {
    if (e.label == params.label) {
      e.msg = params.msg;
      e.status = params.status;
      break;
    }
  }
  console.log('download-progress', params);
};
onMounted(() => {
  window.electron.ipcRenderer.on('download-progress', downloadProgressHandler);
});
onBeforeUnmount(() => {
  window.electron.ipcRenderer.removeListener('download-progress', downloadProgressHandler);
});

defineExpose({
  init
});
</script>

<style lang="less" scoped>
.download-warp {
  .source-warp {
    display: flex;
    justify-content: space-between;
    flex-wrap: nowrap;
    flex-direction: row;
    align-items: center;
    color: var(--td-gray-color-6);
    font-size: var(--td-font-size-link-small);
  }

  .content-warp {
    overflow: auto;
    height: 70vh;
    overflow: auto;
    margin: var(--td-comp-margin-s) 0;

    :deep(.t-button + .t-button) {
      margin-left: 0 !important;
    }
  }

  .tip-warp {
    bottom: calc(var(--td-comp-paddingTB-xxl) + 8px);
    font-size: var(--td-font-size-link-small);
    position: absolute;
    left: calc(var(--td-comp-paddingLR-xxl) + var(--td-size-1));
  }
}

// :deep(.t-select-input) {
//   color: var(--td-font-white-1) !important;
//   background-color: var(--td-bg-color-component) !important;
// }

// :deep(.t-input__inner),
// :deep(.t-transfer) {
//   color: var(--td-font-white-1) !important;
// }

// :deep(.t-input__inner) {
//   &::placeholder {
//     color: var(--td-gray-color-5);
//   }
// }

// .t-select :deep(.t-fake-arrow) {
//   color: var(--td-font-white-3);
// }

// .t-popup__content :deep(*) {
//   background: var(--td-gray-color-11) !important;
// }

// .t-select-option:not(.t-is-disabled):not(.t-is-selected):hover :deep(*) {
//   background-color: var(--td-gray-color-12);
// }

// .t-select-option :deep(*) {
//   color: var(--td-font-white-1);
// }

// .t-select-option.t-select-option__hover:not(.t-is-disabled).t-select-option.t-select-option__hover:not(.t-is-selected)
//   :deep(*) {
//   background-color: var(--td-gray-color-12);
// }

:deep(.t-transfer) {
  color: var(--td-text-color-primary);
  background-color: var(--td-bg-content-input);
  border-radius: var(--td-radius-large);

  &__list-source,
  &__list-target {
    border: var(--td-size-1) solid transparent;
  }

  &__list-header + :not(.t-transfer__list--with-search) {
    border-top: 1px solid var(--td-border-level-1-color);
  }

  &__list-item:hover {
    background-color: rgba(132, 133, 141, 0.16);
  }

  &__list-item.t-is-checked {
    background: var(--td-brand-color);
  }

  .t-checkbox__input {
    border: 1px solid transparent;
    background-color: var(--td-bg-color-secondarycontainer);
  }

  .t-button--variant-outline {
    background-color: var(--td-bg-color-secondarycontainer);
    border-color: transparent;

    &.t-is-disabled {
      border-color: transparent;
    }
  }
}

:deep(.t-input) {
  background-color: var(--td-bg-content-input) !important;
  border: none;
}
</style>
