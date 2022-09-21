import { StatusCodes } from 'http-status-codes';
import { DefaultContext } from 'koa';
import HttpError from "../web/errors/http";
import NotFound from "../web/errors/notFound";

export default () => async (ctx: DefaultContext, next: () => Promise<any>) => {
  try {
      await next();

      if (!ctx.body
          && (!ctx.status
              || ctx.status === StatusCodes.NOT_FOUND
              || ctx.status === StatusCodes.METHOD_NOT_ALLOWED)) {
          throw new NotFound();
      }
  } catch (err) {
      if (err instanceof HttpError) {
          ctx.error({
              statusCode: err.statusCode,
              code: err.code,
              message: err.message,
          });
      } else {
          ctx.error({
              status: StatusCodes.INTERNAL_SERVER_ERROR,
              code: 'UNKNOWN_ERROR',
              message: 'The server encountered an unknown error.',
          });
      }
      ctx.app.emit('error', err, ctx);
  }
};