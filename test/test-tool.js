
const H = require('./helper.js');
const T = H.depJs('lib/tool.js');

describe('Tool', () => {
  it("versionGteq", () => {
    H.assertTrue(T.isVersionGteq('0.0.2', '0.0.1'));
    H.assertTrue(T.isVersionGteq('0.1.2', '0.1.1'));
    H.assertTrue(T.isVersionGteq('0.2.0', '0.1.9'));
    H.assertTrue(T.isVersionGteq('2.0.0', '1.9.0'));
  })

  it("capitalize", () => {
    H.assertEqual(T.capitalize('foo'), 'Foo');
    H.assertEqual(T.capitalize('FOO'), 'Foo');
    H.assertEqual(T.capitalize('foo-bar'), 'FooBar');
    H.assertEqual(T.capitalize('foo_bar'), 'FooBar');
  })

  it("deCapitalize", () => {
    H.assertEqual(T.deCapitalize('FooBar'), 'foo-bar');
    H.assertEqual(T.deCapitalize('FooBar', '.'), 'foo.bar');
  })

  it("replaceLastMatch", () => {
    const str = 'abcdabcdabcd';
    H.assertEqual(T.replaceLastMatch(str, /def/ig, "XXX"), 'abcdabcdabcd');
    H.assertEqual(T.replaceLastMatch(str, /bcd/ig, "BCD"), 'abcdabcdaBCD');
  })

  it("deleteLastPart", () => {
    H.assertEqual(T.deleteLastPart('a.b.c'), 'a.b');
  });

  it("isExtensionUrl", () => {
    H.assertTrue(T.isExtensionUrl("moz-extension://abc/index"));
    H.assertTrue(T.isExtensionUrl("chrome-extension://abc/index"));
    H.assertFalse(T.isExtensionUrl("http://example.org/index"));
  })

  it("calcPath(currDir, destDir)", () => {
    H.assertEqual(T.calcPath('a', 'a/b'), 'b')
    H.assertEqual(T.calcPath('a', ''), '../')
    H.assertEqual(T.calcPath('a/b', 'a'), '../')
    H.assertEqual(T.calcPath('a/b/c', 'a/b'), '../')
    H.assertEqual(T.calcPath('a/b/c', 'a'), '../../')
  })

  it("splitFilename", () => {
    const [nameA, extA] = T.splitFilename('foo');
    H.assertEqual(nameA, 'foo');
    H.assertEqual(extA, null);
    const [nameB, extB] = T.splitFilename('foo.big.txt');
    H.assertEqual(nameB, 'foo.big');
    H.assertEqual(extB, 'txt');
  });

  it("extractRgbStr", () => {
    H.assertEqual(T.extractRgbStr('rgb(255, 255, 255)').length, 3);
    H.assertEqual(T.extractRgbStr('rgb(255,255,255)').length, 3);
    H.assertEqual(T.extractRgbStr('rgba(0,0,0,0)').length, 4);
    const [r, g, b] = T.extractRgbStr('rgb(1,2,3)');
    H.assertEqual(r, 1);
    H.assertEqual(g, 2);
    H.assertEqual(b, 3);
  });

  it('completeUrl', () => {
    const baseUrl = 'https://a.org/index.html';

    let r0;
    r0 = T.completeUrl(undefined, baseUrl);
    H.assertEqual(r0.isValid, false);
    r0 = T.completeUrl(null, baseUrl);
    H.assertEqual(r0.isValid, false);
    r0 = T.completeUrl('', baseUrl);
    H.assertEqual(r0.isValid, false);

    const r1 = T.completeUrl('/a/b/c', baseUrl);
    H.assertEqual(r1.isValid, true);
    H.assertEqual(r1.url, 'https://a.org/a/b/c');

    const r2 = T.completeUrl('/a/b/c', undefined);
    H.assertEqual(r2.isValid, false);
    H.assertTrue(r2.message.length > 0);
  })

  it('isHttpUrl', () => {
    H.assertEqual(T.isHttpUrl('http://a.org'), true);
    H.assertEqual(T.isHttpUrl('https://a.org'), true);
    H.assertEqual(T.isHttpUrl('file:///foo/index.html'), false);
    H.assertEqual(T.isHttpUrl('chrome-extension://foo'), false);
    H.assertEqual(T.isHttpUrl('moz-extension://foo'), false);
    H.assertEqual(T.isHttpUrl('chrome://communicator/skin'), false);

    H.assertEqual(T.isHttpUrl('about:home'), false);
    H.assertEqual(T.isHttpUrl('javascript:void(0)'), false);
    H.assertEqual(T.isHttpUrl('data:image/png;base64,data'), false);
    H.assertEqual(T.isHttpUrl('mailto:a@b.org'), false);
    H.assertEqual(T.isHttpUrl('tel:+4912345'), false);
  });

  it('url2Anchor', () => {
    let pageUrl = 'http://a.org/b/c?a=1&b=2',
    currUrl = null;
    H.assertEqual(T.url2Anchor(currUrl, pageUrl), '');
    currUrl = '';
    H.assertEqual(T.url2Anchor(currUrl, pageUrl), currUrl);
    currUrl = 'invalidUrl';
    H.assertEqual(T.url2Anchor(currUrl, pageUrl), currUrl);
    currUrl = 'http://b.org/b/c';
    H.assertEqual(T.url2Anchor(currUrl, pageUrl), currUrl);
    currUrl = 'http://a.org/b/c?b=2&a=1';
    H.assertEqual(T.url2Anchor(currUrl, pageUrl), currUrl);
    currUrl = 'http://a.org/b/c?a=1&b=2#foo';
    H.assertEqual(T.url2Anchor(currUrl, pageUrl), '#foo');
    currUrl = 'http://a.org/b/c?b=2&a=1#bar';
    H.assertEqual(T.url2Anchor(currUrl, pageUrl), '#bar');

    currUrl = 'http://a.org/b/c#';
    pageUrl = 'http://a.org/b/c';
    H.assertEqual(T.url2Anchor(currUrl, pageUrl), '#');

    pageUrl = 'http://a.org/b/c?a=1&b=2#aaa';
    currUrl = 'http://a.org/b/c?a=1&b=2#bbb';
    H.assertEqual(T.url2Anchor(currUrl, pageUrl), '#bbb');
  });

})
