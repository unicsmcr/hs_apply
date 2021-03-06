import { Router } from 'express';
import { AdminController } from '../controllers';
import { RouterInterface, provideRouter } from './registerableRouter';
import { RequestAuthentication } from '../util/auth';

@provideRouter()
export class AdminRouter implements RouterInterface {
	private readonly _adminController: AdminController;
	private readonly _requestAuth: RequestAuthentication;

	public constructor(
		adminController: AdminController,
		requestAuth: RequestAuthentication
	) {
		this._adminController = adminController;
		this._requestAuth = requestAuth;
	}

	public getPathRoot = (): string => '/admin';

	public register = (): Router => {
		const router: Router = Router();

		router.get('/overview', this._requestAuth.withAuthMiddleware(this, this._adminController.overview));

		router.get('/manage', this._requestAuth.withAuthMiddleware(this, this._adminController.manage));

		router.get('/manage/downloadCSV',
			this._requestAuth.withAuthMiddleware(this, this._adminController.downloadCSV));

		router.get(
			'/manage/download-cvs',
			this._requestAuth.withAuthMiddleware(this, this._adminController.downloadAllCVsFromDropbox)
		);

		router.get('/manage/:id([a-z0-9-]+)',
			this._requestAuth.withAuthMiddleware(this, this._adminController.manageApplication));

		return router;
	};
}
