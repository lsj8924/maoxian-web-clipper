
"use strict";
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // CJS
    module.exports = factory(
      require('../lib/tool.js'),
      require('../lib/dom-tool.js'),
      require('../lib/log.js'),
      require('../lib/ext-msg.js'),
      require('../lib/task.js'),
      require('../lib/template.js'),
      require('../capturer/tool.js'),
      require('../capturer/a.js'),
      require('../capturer/img.js'),
      require('../capturer/style.js'),
      require('../capturer/link.js'),
      require('../capturer/iframe.js'),
      require('./style-helper.js')
    );
  } else {
    // browser or other
    root.MxWcHtml = factory(
      root.MxWcTool,
      root.MxWcDOMTool,
      root.MxWcLog,
      root.MxWcExtMsg,
      root.MxWcTask,
      root.MxWcTemplate,
      root.MxWcCaptureTool,
      root.MxWcCapturerA,
      root.MxWcCapturerPicture,
      root.MxWcCapturerImg,
      root.MxWcCapturerStyle,
      root.MxWcCapturerLink,
      root.MxWcCapturerIframe,
      root.MxWcStyleHelper
    );
  }
})(this, function(T, DOMTool, Log, ExtMsg, Task, Template, CaptureTool,
    CapturerA,
    CapturerPicture,
    CapturerImg,
    CapturerStyle,
    CapturerLink,
    CapturerIframe, StyleHelper, undefined) {
  "use strict";

  /*
   * @param {Object} params
   */
  async function parse(params){
    Log.debug("html parser");
    const {storageInfo, elem, info, config} = params;

    const [mimeTypeDict, frames] = await Promise.all([
      ExtMsg.sendToBackground({type: 'get.mimeTypeDict'}),
      ExtMsg.sendToBackground({type: 'get.allFrames'}),
    ])

    const headerParams = {
      refUrl: window.location.href,
      userAgent: window.navigator.userAgent,
      referrerPolicy: config.requestReferrerPolicy,
    }

    const isBodyElem = elem.tagName === 'BODY';


    // 获取选中元素的html
    const {elemHtml, headInnerHtml, tasks} = await getElemHtml({
      clipId: info.clipId,
      frames: frames,
      storageInfo: storageInfo,
      elem: elem,
      docUrl: window.location.href,
      baseUrl: window.document.baseURI,
      mimeTypeDict: mimeTypeDict,
      config: config,
      headerParams: headerParams,
      needFixStyle: !isBodyElem,
    });

    // 将elemHtml 渲染进模板里，渲染成完整网页。
    const v = StyleHelper.getRenderParams(elem);
    const page = (isBodyElem ? 'bodyPage' : 'elemPage');
    v.info = info;
    v.headInnerHtml = headInnerHtml;
    v.elemHtml = elemHtml;
    v.config = config;
    const html = Template[page].render(v);
    const filename = T.joinPath(storageInfo.saveFolder, info.filename)

    const mainFileTask = Task.createHtmlTask(filename, html, info.clipId);
    tasks.push(mainFileTask);

    return Task.changeUrlTask(tasks, (task) => {
      task['headers'] = CaptureTool.getRequestHeaders(
        task.url, headerParams);
      task['timeout'] = config.requestTimeout;
    });
  }

  async function getElemHtml(params){
    const topFrameId = 0, saveFormat = 'html';
    const {
      clipId,
      frames,
      storageInfo,
      elem,
      baseUrl,
      docUrl,
      mimeTypeDict,
      parentFrameId = topFrameId,
      config,
      headerParams,
      needFixStyle,
    } = params;
    Log.debug('getElemHtml', baseUrl);

    const KLASS = ['mx-wc', clipId].join('-');
    elem.classList.add('mx-wc-selected-elem');
    elem.classList.add(KLASS);
    DOMTool.markHiddenNode(window, elem);
    const docHtml = document.documentElement.outerHTML;
    elem.classList.remove('mx-wc-selected-elem');
    elem.classList.remove(KLASS);
    DOMTool.clearHiddenMark(elem);

    const {doc} = DOMTool.parseHTML(docHtml);
    let selectedNode = doc.querySelector('.' + KLASS);
    Log.debug(selectedNode);
    selectedNode = DOMTool.removeNodeByHiddenMark(selectedNode);

    const styleNodes   = doc.querySelectorAll('style');
    const linkNodes    = doc.querySelectorAll('link');
    const pictureNodes = DOMTool.querySelectorIncludeSelf(selectedNode, 'picture');
    const imgNodes     = DOMTool.querySelectorIncludeSelf(selectedNode, 'img');
    const aNodes       = DOMTool.querySelectorIncludeSelf(selectedNode, 'a');
    const iframeNodes  = DOMTool.querySelectorIncludeSelf(selectedNode, 'iframe');
    const frameNodes   = DOMTool.querySelectorIncludeSelf(selectedNode, 'frame');

    const captureInfos = [
      {
        nodes: linkNodes,
        capturer: CapturerLink,
        opts: {baseUrl, docUrl, storageInfo, clipId, mimeTypeDict, config, headerParams, needFixStyle}
      },
      {
        nodes: styleNodes,
        capturer: CapturerStyle,
        opts: {baseUrl, docUrl, storageInfo, clipId, mimeTypeDict, config, headerParams, needFixStyle}
      },
      {
        nodes: pictureNodes,
        capturer: CapturerPicture,
        opts: {baseUrl, storageInfo, clipId, mimeTypeDict}
      },
      {
        nodes: imgNodes,
        capturer: CapturerImg,
        opts: {saveFormat, baseUrl, storageInfo, clipId, mimeTypeDict}
      },
      {
        nodes: aNodes,
        capturer: CapturerA,
        opts: {baseUrl, docUrl}
      },
      {
        nodes: iframeNodes,
        capturer: CapturerIframe,
        opts: {saveFormat, baseUrl, doc, storageInfo, clipId, mimeTypeDict, config, parentFrameId, frames}
      },
      {
        nodes: frameNodes,
        capturer: CapturerIframe,
        opts: {saveFormat, baseUrl, doc, storageInfo, clipId, mimeTypeDict, config, parentFrameId, frames}
      }
    ];

    const taskCollection = [];

    for (let i = 0; i < captureInfos.length; i++) {
      const it = captureInfos[i];
      for (let j = 0; j < it.nodes.length; j++) {
        const node = it.nodes[j];
        if (node === selectedNode) {
          const r = await it.capturer.capture(node, it.opts);
          taskCollection.push(...r.tasks);
          selectedNode = r.node;
        } else {
          const r = await it.capturer.capture(node, it.opts);
          taskCollection.push(...r.tasks);
        }
      }
    }



    const headInnerHtml = [
      getNodesHtml(doc.querySelectorAll('link[rel*=icon]')),
      getNodesHtml(doc.querySelectorAll('link[rel~=stylesheet]')),
      getNodesHtml(doc.querySelectorAll('style')),
    ].join("\n");

    let elemHtml = "";
    if(elem.tagName === 'BODY') {
      elemHtml = dealBodyElem(selectedNode, elem);
    } else {
      elemHtml = dealNormalElem(selectedNode, elem);
    }
    return { elemHtml: elemHtml, headInnerHtml: headInnerHtml, tasks: taskCollection};
  }

  function dealBodyElem(node, originalNode) {
    node = removeUselessNode(node);
    return node.outerHTML;
  }

  function dealNormalElem(node, originalNode){
    node.style = StyleHelper.getSelectedNodeStyle(originalNode);
    node = removeUselessNode(node);
    return wrapToBody(originalNode, node.outerHTML);
  }

  function removeUselessNode(contextNode){
    return DOMTool.removeNodeBySelectors(contextNode, [
      'link',
      'style',
      'script',
      'template',
      '*[data-mx-ignore-me="true"]'
    ]);
  }

  /* wrap to body element */
  function wrapToBody(elem, html){
    let pElem = elem.parentElement;
    while(pElem && ['html', 'body'].indexOf(pElem.tagName.toLowerCase()) == -1){
      const tagName = pElem.tagName

      const attrs = [];
      T.each(pElem.attributes, function(attr){
        if(attr.name !== "style"){
          attrs.push([attr.name, attr.value]);
        }
      });
      attrs.push(['style', StyleHelper.getWrapperStyle(pElem)]);
      const attrHtml = T.map(attrs, function(pair){
        return `${pair[0]}="${pair[1]}"`;
      }).join(' ');
      html = `<${tagName} ${attrHtml}>${html}</${tagName}>`;
      pElem = pElem.parentElement;
    }
    return html;
  }


  function getNodesHtml(nodes) {
    const outerHtmls = [];
    [].forEach.call(nodes, (node) => {
      if (!node.hasAttribute('data-mx-ignore-me')) {
        outerHtmls.push(node.outerHTML);
      }
    });

    return outerHtmls.length === 0 ? '' : ['', ...outerHtmls, ''].join('\n');
  }

  return {
    parse: parse,
    getElemHtml: getElemHtml
  }
});
