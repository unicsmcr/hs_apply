import * as passport from "passport";
import * as querystring from "querystring";
import { Express, Request, Response, Application, NextFunction, CookieOptions } from "express";
import * as CookieStrategy from "passport-cookie";
import { injectable, inject } from "inversify";
import { TYPES } from "../../types";
import { Cache } from "../cache";
import { getCurrentUser, RequestUser, AuthLevels } from "@unicsmcr/hs_auth_client";

export interface RequestAuthenticationInterface {
  passportSetup: (app: Application) => void;
}

@injectable()
export class RequestAuthentication {
  private _cache: Cache;

  public constructor(@inject(TYPES.Cache) cache: Cache) {
    this._cache = cache;
  }

  private logout = (app: Express): void => {
    let logoutCookieOptions: CookieOptions = undefined;
    if (app.get("env") === "production") {
      logoutCookieOptions = {
        domain: app.locals.settings.rootDomain,
        secure: true,
        httpOnly: true
      };
    }

    app.get("/logout", function(req: Request, res: Response) {
      res.cookie("Authorization", "", logoutCookieOptions);
      return res.redirect("/");
    });
  };

  public passportSetup = (app: Express): void => {
    this.logout(app);

    app.use(passport.initialize());
    passport.use(
      new CookieStrategy(
        {
          cookieName: "Authorization",
          passReqToCallback: true
        },
        async (req: Request, token: string, done: (error: string, user?: any) => void): Promise<void> => {
          let apiResult: RequestUser;
          try {
            apiResult = await getCurrentUser(token, req.originalUrl);
          } catch (err) {
            return done(undefined, false);
          }

          req.user = apiResult;
          return done(undefined, apiResult);
        }
      )
    );
  };

  public authenticate = (req: Request, res: Response): Promise<RequestUser> => {
    return new Promise((resolve, reject) => {
      passport.authenticate("cookie", { session: false }, (err: any, user: RequestUser) => {
        if (err) reject(new Error(err));
        else if (!user) reject(new Error("Not authenticated"));
        resolve(user);
      })(req, res);
    });
  };

  public checkLoggedIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let user: RequestUser;
    try {
      user = await this.authenticate(req, res);
    } catch (err) {
      // Either user was not authenticated, or an error occured during authentication
      // In both cases we redirect them to the login
      const queryParam: string = querystring.encode({
        returnto: `${process.env.APPLICATION_URL}${req.originalUrl}`
      });
      res.redirect(`${process.env.AUTH_URL}/login?${queryParam}`);
      return;
    }
    res.locals.authLevel = user.authLevel;
    return next();
  };

  public checkAuthLevel = (req: Request, res: Response, user: RequestUser, requiredAuth: AuthLevels): boolean => {
    if (!user || user.authLevel < requiredAuth) {
      const queryParam: string = querystring.encode({ returnto: `${process.env.APPLICATION_URL}${req.originalUrl}` });
      res.redirect(`${process.env.AUTH_URL}/login?${queryParam}`);
      return;
    }
    return true;
  };

  public checkIsAttendee = (req: Request, res: Response, next: NextFunction): void => {
    if (this.checkAuthLevel(req, res, req.user as RequestUser, AuthLevels.Attendee)) {
      res.locals.isAttendee = true;
      return next();
    }
  };

  public checkIsVolunteer = (req: Request, res: Response, next: NextFunction): void => {
    if (this.checkAuthLevel(req, res, req.user as RequestUser, AuthLevels.Volunteer)) {
      res.locals.isVolunteer = true;
      return next();
    }
  };

  public checkIsOrganiser = (req: Request, res: Response, next: NextFunction): void => {
    if (this.checkAuthLevel(req, res, req.user as RequestUser, AuthLevels.Organiser)) {
      res.locals.isOrganiser = true;
      res.locals.isVolunteer = true;
      return next();
    }
  };
}
