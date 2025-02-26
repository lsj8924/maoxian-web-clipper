;(function(root, factory) {
  factory(
    root.MxWcTool,
    root.MxWcLog,
    root.MxWcI18N,
    root.MxWcExtApi,
    root.MxWcExtMsg,
    root.MxWcStorage,
    root.MxWcConfig,
    root.MxWcLink,
    root.MxWcQuery,
    root.MxWcNotify,
    root.MxWcHandler
  );

})(this, function(T, Log, I18N, ExtApi, ExtMsg,
    MxWcStorage, MxWcConfig, MxWcLink, Query, Notify, MxWcHandler, undefined) {
  "use strict";

  const state = { allClips: [], currClips: [], categories: [], tags: [] };

  function listenMessage() {
    ExtMsg.initPage('history');
    ExtMsg.listen(function(msg) {
      return new Promise((resolve, reject) => {
        switch(msg.type) {
          case 'history.reseted':
            resetHistory();
            resolve();
          default: break;
        }
      });
    });
  }

  function showHistory(){
    searchAction();
  }

  function showClip(e){
    const tr = e.target.parentElement;
    const id = tr.getAttribute('data-id');
    const clip =  T.detect(state.currClips, (clip) => { return clip.clipId == id });
    if(clip){
      Promise.all([
        MxWcStorage.get('downloadFolder'),
        MxWcConfig.load(),
        ExtApi.isAllowedFileSchemeAccess()
      ]).then((values) => {
        const [downloadFolder, config, allowFileSchemeAccess] = values;
        const allowFileUrlAccess = (allowFileSchemeAccess || config.allowFileSchemeAccess);
        let {url} = clip;
        let filename = clip.filename ? clip.filename : `index.${clip.format}`;
        const clipPath = T.replacePathFilename(clip.path, filename);
        if(!url) {
          url = clipPath;
          if(downloadFolder){
            url = T.toFileUrl([downloadFolder, clipPath].join(''));
          }
        }
        if(downloadFolder && allowFileUrlAccess){
          renderClipDetailModel_openUrlDirectly(clip, url);
        }else{
          ExtApi.findDownloadItemByPath(clipPath)
            .then((downloadItem) => {
              if(downloadItem){
                renderClipDetailModel_openUrlByDownloadItem(clip, url, downloadItem);
              }else{
                renderClipDetailModel_openUrlByCopyAndPaste(clip, url);
              }
            })
        }
      });
    }
  }

  // Although user allow extension access to file URLs,
  // Place "file URL" in link's href attribute will raise "Not allowed to load local resource"
  // open link through create new tab.
  function renderClipDetailModel_openUrlDirectly(clip, url){
    Log.debug('directly');
    const modal = T.queryElem('.modal');
    const modalContent = T.queryElem('.modal .content');
    const html = renderClipDetail({
      urlAction: 'openUrlDirectly',
      clip: clip,
      url: url
    });
    T.setHtml(modalContent, html);
    modal.style.display = 'block';
    const elem = T.queryElem('.modal .content .path-link');
    T.bind(elem, 'click', function(e){
      e.preventDefault();
      modal.style.display = 'none';
      ExtApi.createTab(url);
    })
  }

  // If download item is still in browser's download history,
  // we can use extension api to open download item.
  function renderClipDetailModel_openUrlByDownloadItem(clip, url, downloadItem){
    Log.debug('by download item');
    const modal = T.queryElem('.modal');
    const modalContent = T.queryElem('.modal .content');
    const html = renderClipDetail({
      urlAction: 'openUrlByDownloadItem',
      clip: clip,
      url: url,
      downloadItem: downloadItem
    });
    T.setHtml(modalContent, html);
    modal.style.display = 'block';
    const elem = T.queryElem('.modal .content .path-link');
    T.bind(elem, 'click', function(e){
      e.preventDefault();
      modal.style.display = 'none';
      ExtApi.openDownloadItem(downloadItem.id);
    })
  }

  // Worst situation
  // Help user to copy file URL :(
  function renderClipDetailModel_openUrlByCopyAndPaste(clip, url){
    const modal = T.queryElem('.modal');
    const modalContent = T.queryElem('.modal .content');
    const html = renderClipDetail({
      urlAction: 'openUrlByCopyAndPaste',
      clip: clip,
      url: url
    });
    T.setHtml(modalContent, html);
    modal.style.display = 'block';
    const elem = T.queryElem('.modal .content .path');
    T.bind(elem, 'mouseover', function(e){ this.select() });
    elem.select();
  }

  function renderClipDetail(v) {
    const template = T.findElem('modal-content-tpl').innerHTML;
    let clipPath = "";
    switch(v.urlAction){
      case 'openUrlDirectly':
      case 'openUrlByDownloadItem':
        clipPath = `<a class="path-link" href="">${v.url}</a>`;
        break;
      case 'openUrlByCopyAndPaste':
        clipPath =`<input type="text" class='path' readonly="true" value="${v.url}" />`;
        break;
    }
    return T.renderTemplate(template, {
      title: T.escapeHtml(v.clip.title),
      clipPath: clipPath,
      originalUrl: v.clip.link,
      createdAt: v.clip.created_at,
      category: v.clip.category,
      tags: v.clip.tags.join(", "),
      format: v.clip.format
    });
  }


  function renderClips(clips){
    state.currClips = clips;

    const list = T.queryElem('.list');
    const hint = T.queryElem('.no-record');
    list.style.display = 'none';
    hint.style.display = 'none';
    if(clips.length > 0) {
      const trowTpl  = T.findElem('trow-tpl').innerHTML;
      const items = [];
      clips.forEach(function(clip){
        items.push(T.renderTemplate(trowTpl, {
          clipId: clip.clipId,
          time: renderTime(clip),
          category: clip.category,
          tags: clip.tags.join(", "),
          format: clip.format,
          title: T.escapeHtml(clip.title)
        }));
      });
      T.setHtml('.clippings > tbody', items.join(''));
      list.style.display = 'block';
    } else {
      hint.style.display = 'block';
    }
    bindClipListener();
  }

  function renderTime(clip) {
    try{
      const t = T.wrapDate(clip.created_at_date).str;
      return [t.month, t.day].join('/')
    }catch(e) {
      return '-/-'
    }
  }

  function bindClipListener(){
    const tbody = T.queryElem(".list > table > tbody");
    if(tbody) {
      T.bindOnce(tbody, 'click', tbodyClick, true);
    }
  }

  function tbodyClick(e){
    if(e.target.tagName === 'A') {
      /* action clicked */
      const [operation, id] = e.target.href.split(':');
      switch(operation) {
        case 'history.delete' : deleteHistory(id); break;
        default: break;
      }
      e.stopPropagation();
      e.preventDefault();
    } else {
      showClip(e);
    }
  }

  function deleteHistory(id) {
    MxWcHandler.isReady('NativeApp')
    .then((r) => {
      if(r.ok) {
        if(T.isVersionGteq(r.handlerInfo.version, '0.1.9')) {
          deleteHistoryAndFile(r.config, id);
        } {
          console.debug("Native App not support this message, version: ", r.handlerInfo.version);
        }
      } else {
        deleteHistoryOnly(id);
      }
    });
  }

  function deleteHistoryAndFile(config, id) {
    MxWcStorage.get('downloadFolder').then((downloadFolder) => {
      if(downloadFolder) {
        confirmIfNeed(I18N.t('history.confirm-msg.delete-history-and-file'), () => {
          const clip =  T.detect(state.currClips, (clip) => { return clip.clipId == id });
          const path = [downloadFolder, clip.path].join('');
          const root = [downloadFolder, config.rootFolder].join('');
          const saveFolder = path.replace('/index.json', '');
          let assetFolder = '';
          if(config.assetPath.indexOf('$CLIPPING-PATH') > -1) {
            assetFolder = [saveFolder, config.assetPath.replace('$CLIPPING-PATH/', '')].join('/');
          } else {
            if(config.assetPath.indexOf('$STORAGE-PATH') > -1) {
              assetFolder = [root, config.assetPath.replace('$STORAGE-PATH/', '')].join('/');
            } else {
              const relativePath = (config.assetPath === '' ? 'assets' : config.assetPath);
              assetFolder = [saveFolder, relativePath].join('/')
            }
          }
          const msg = {
            clip_id: clip.clipId,
            path: path,
            asset_folder: assetFolder
          }
          ExtMsg.sendToBackground({
            type: 'clipping.delete',
            body: msg
          }).then((result) => {
            if(result.ok) {
              deleteHistoryOnly(result.clip_id, true);
              if(result.message){
                Notify.error(t(result.message));
              } else {
                Notify.success(I18N.t('history.notice.delete-history-success'));
              }
            } else {
              console.error(result)
              Notify.error(t(result.message));
            }
          });
        });
      } else {
        console.error("Error: downloadFolder not present");
      }
    });
  }

  function deleteHistoryOnly(id, noConfirm=false) {
    const clip = state.currClips.find((clip) => {
      return clip.clipId === id;
    })
    if(clip) {
      const action = function(){
        state.currClips.splice(state.currClips.indexOf(clip), 1);
        if(state.allClips.indexOf(clip) > -1){
          // state.currClips and state.allClips may be the same object.
          state.allClips.splice(state.allClips.indexOf(clip), 1);
        }
        MxWcStorage.set('clips', state.allClips)
        removeTrByClipId(id)
      }
      if(noConfirm) {
        action();
      } else {
        confirmIfNeed(I18N.t('history.confirm-msg.delete-history'), action);
      }
    }
  }

  function removeTrByClipId(id) {
    const q = `.list > table > tbody > tr[data-id="${id}"]`
    const tr = T.queryElem(q)
    if(tr) {
      tr.parentNode.removeChild(tr);
    }
  }

  async function initSearch(){
    const search = T.findElem('search');
    search.value = await cacheGet('search.keyword', '');

    //created_at
    const i18n = Pikaday.getI18n(ExtApi.locale);
    const pickerA = new Pikaday({
      field: T.findElem('created-at-from'),
      i18n: i18n,
      toString(date, format) {
        const t = T.wrapDate(date);
        return t.beginingOfDay();
      }
    })
    const pickerB = new Pikaday({
      field: T.findElem('created-at-to'),
      i18n: i18n,
      toString(date, format) {
        const t = T.wrapDate(date);
        return t.endOfDay();
      }
    })

    const categoryInput = T.findElem('category')
    const aotoCompleteCategory = new Awesomplete(
      categoryInput,
      {
        autoFirst: true,
        minChars: 1,
        list: state.categories
      }
    );


    const tagInput = T.findElem('tag');
    const aotoCompleteTag = new Awesomplete(
      tagInput,
      {
        autoFirst: true,
        minChars: 1,
        list: state.tags
      }
    );

    initSearchListeners();
  }

  function initSearchListeners(){
    T.queryElems('.search-box').forEach((searchBox) => {
      T.bind(searchBox, 'keypress', function(e) {
        if(e.target.tagName === 'INPUT' && e.keyCode === 13) {
          // Press Enter in input
          searchAction(e);
        }
      })
    });
    const btn = T.findElem('search-btn');
    T.bindOnce(btn, 'click', searchAction);
    const btns = T.queryElems('button[type=reset]');
    T.each(btns, (it) => {
      T.bind(it, 'click', function(e) {
        e.target.parentNode.reset();
        searchAction();
      });
    });
  }

  function searchAction(e){
    if(e) { e.preventDefault()}
    const qRowA = {__logic__: 'AND'};
    const [isRangerValid, from, to] = getDateRanger();
    if(isRangerValid) {
      qRowA.created_at_time = ['between', from, to]
    }
    const category = T.findElem('category').value.trim();
    if(category !== "") {
      qRowA.category = ['equal', category]
    }
    const tag = T.findElem('tag').value.trim();
    if(tag !== "") {
      qRowA.tags = ['memberInclude', tag];
    }

    let qRowB = {};
    const keyword = T.findElem('search').value.trim();
    cacheSet('search.keyword', keyword);
    if(keyword !== ""){
      const regExp = new RegExp(keyword, 'i');
      qRowB = {
        __logic__: 'OR',
        title: ['match', regExp],
        category: ['match', regExp],
        tags: ['memberMatch', regExp],
        link: ['equal', keyword]
      };
    }
    const filterA = Query.q2Filter(qRowA);
    const filterB = Query.q2Filter(qRowB);
    const clips = Query.queryObjByFilter(state.allClips,
      Query.combineFilter('AND', filterA, filterB));
    renderClips(clips);
  }

  function getDateRanger(){
    let fromStr = T.findElem('created-at-from').value.trim();
    let toStr = T.findElem('created-at-to').value.trim();
    const ParseFail = [false, null, null];
    const isValid = (tStr) => { return !isNaN(Date.parse(tStr)); }
    if(isValid(fromStr)) {
      const from = Date.parse(fromStr);
      const to = (isValid(toStr) ? Date.parse(toStr) : Date.now() );
      return [true, from, to]
    } else {
      return [false, null, null];
    }
  }

  function confirmIfNeed(message, action) {
    const input = T.findElem('confirm-mode');
    if(input.checked){
      if(window.confirm(message)){
        action();
      }
    } else {
      action();
    }
  }

  function resetHistory() {
    T.queryElems('form').forEach((it) => {
      it.reset();
    });
    MxWcStorage.get('clips', []).then((clips) => {
      initState(clips);
      searchAction();
    });
  }


  function clearHistory(e){
    confirmIfNeed(I18N.t('history.confirm-msg.clear-history'), () => {
      MxWcStorage.set('clips', [])
      initState([]);
      renderClips([]);
      Notify.success(I18N.t('history.notice.clear-history-success'));
    })
  }

  function exportHistory(e){
    let content = T.toJson({error: I18N.t('history.export.no-record')});
    if(state.currClips.length > 0){
      content = T.toJson(state.currClips)
    }
    ExtMsg.sendToBackground({
      type: 'export.history',
      body: {content: content}
    });
  }

  function initLinks(){
    const elem = T.queryElem(".links");
    const links = [
      {name: I18N.t('history.a.reset-history'), pageName: "extPage.reset-history" }
    ]
    links.forEach((link) => {
      const a = document.createElement("a");
      a.href = MxWcLink.get(link.pageName);
      a.target = '_blank';
      a.innerText = link.name;
      elem.appendChild(a);
    })
  }

  function initActions(){
    const btnClearHistory = T.findElem('clear-history');
    const btnExportHistory = T.findElem('export-history');
    T.bindOnce(btnClearHistory, 'click', clearHistory);
    T.bindOnce(btnExportHistory, 'click', exportHistory);
  }


  function initModal(){
    const elem = T.queryElem('.modal .mask');
    T.bindOnce(elem, 'click', hideModal);
    T.bind(document, 'keydown', function(e){
      if(e.keyCode === 27){
        hideModal();
      }
    });
    const content = T.queryElem('.modal .content');
    T.bind(content, 'click', function(e){
      e.stopPropagation();
    })
  }

  function hideModal(){
    const modal = T.queryElem('.modal');
    modal.style.display = 'none';
  }

  async function initSwitches(){
    await initCheckbox({
      domId: 'confirm-mode',
      storageKey: 'enableConfirmMode',
      defaultValue: true
    });

    await initCheckbox({
      domId: 'advanced-search-mode',
      storageKey: 'enableAdvancedSearchMode',
      defaultValue: false,
      action: function(checked) {
        const box = T.queryElem('.advanced-search-mode');
        box.style.display = (checked ? 'block' : 'none');
      }
    });
  }

  async function initCheckbox(options) {
    const {domId, storageKey, defaultValue, action} = options;
    const input = T.findElem(domId);
    const checked = await cacheGet(storageKey, defaultValue);
    input.checked = checked;
    if(action){ action(input.checked) }
    T.bind(input, 'click', async function(e){
      cacheSet(storageKey, e.target.checked);
      if(action){ action(e.target.checked) }
    });
  }

  // TODO delete me.
  async function migrateLocalStorage() {

    const migrationKey = 'localstorage.migrated';
    const v = await cacheGet(migrationKey);
    if(v) {
      console.debug('migrated');
    } else {
      try {
        const keys = ['search.keyword', 'enableConfirmMode', 'enableAdvancedSearchMode' ];
        for(let i=0; i<keys.length; i++) {
          const k = keys[i];
          const value = window.localStorage.getItem(k);
          if(value !== null) {
            if (value === 'true') {
              await cacheSet(k, true);
            } else if (value === 'false') {
              await cacheSet(k, false);
            } else {
              await cacheSet(k, value);
            }
          }
        }
        await cacheSet(migrationKey, true);
        console.debug('run migration');
      } catch(e) {
        // User care about their privacy. set migrated, using deafult value
        await cacheSet(migrationKey, true);
        console.debug('run migration');
      }
    }
  }

  async function cacheSet(key, value) {
    return await MxWcStorage.set(prefixCacheKey(key), value);
  }

  async function cacheGet(key, defaultValue) {
    return await MxWcStorage.get(prefixCacheKey(key), defaultValue);
  }

  function prefixCacheKey(key) {
    return ['history.page.cache', key].join('.');
  }

  function initState(clips) {
    clips.forEach(function(clip) {
      if(state.categories.indexOf(clip.category) < 0) {
        state.categories.push(clip.category);
      }
      clip.tags.forEach(function(tag) {
        if(state.tags.indexOf(tag) < 0) {
          state.tags.push(tag);
        }
      })
      clip.created_at_date = new Date(clip.created_at);
      clip.created_at_time = clip.created_at_date.getTime();
    });
    state.allClips = clips;
  }

  async function init(){
    await migrateLocalStorage();
    listenMessage();
    const clips = await MxWcStorage.get('clips', []);
    initState(clips);
    await initSearch();
    initLinks();
    initActions();
    await initSwitches();
    initModal();
    I18N.i18nPage();
    showHistory();
  }

  init();
});
