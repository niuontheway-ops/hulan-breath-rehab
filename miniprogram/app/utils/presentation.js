const {store}=require('./store');
const {today}=require('./calendar');

function refresh(page,extra={}) {
  const result=store.load();
  page.setData({senior:result.state.settings.senior,reducedMotion:result.state.settings.reducedMotion,storageError:result.ok?'':result.message,...extra});
  return result;
}
function notice(message,title='提示') { wx.showModal({title,content:message,showCancel:false}); }
function resultNotice(result,message='已保存在本机') {
  if(!result.ok){notice(result.message||'本机保存失败，请重试。','未保存');return false;}
  wx.showToast({title:message,icon:'success'});return true;
}
function navigate(url) {wx.navigateTo({url});}
function tab(url) {wx.switchTab({url});}
function number(value) {
  if(value===null||value===undefined||String(value).trim()==='')return null;
  const input=String(value).trim();return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(input)?Number(input):NaN;
}
module.exports={refresh,notice,resultNotice,navigate,tab,number,today};
