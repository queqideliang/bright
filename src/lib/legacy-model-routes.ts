/** Compatibility for clients of the retired model pipeline. No file body is read or forwarded. */
export function retiredUpload() {
  return Response.json({
    error: "旧版模型上传接口已停用，请前往模型库上传。",
    libraryUrl: "/models",
    workbenchUrl: "/workbench",
  }, { status: 410 });
}

export function retiredReview() {
  return Response.json({
    error: "旧版模型处理接口已停用，请在工作台查看、算量或审核模型。",
    libraryUrl: "/models",
    workbenchUrl: "/workbench",
  }, { status: 410 });
}
