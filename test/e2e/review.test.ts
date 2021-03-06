import { getTestDatabaseOptions } from '../util';
import { mockFrontendRenderer, mockRequestAuthentication, mockSettingsLoader, mockHackathonConfigCache, mockEmailService } from '../util/mocks';

import request from 'supertest';
import { App } from '../../src/app';
import { Express } from 'express';
import { HttpResponseCode } from '../../src/util/errorHandling';
import { Applicant, Review } from '../../src/models/db';
import { RequestAuthentication } from '../../src/util/auth';
import { SettingLoader } from '../../src/util/fs';
import { mock, instance, when, objectContaining } from 'ts-mockito';
import { Repository } from 'typeorm';
import { InjectedRepository } from '../../src/repositories';
import { ApplicantService, EmailService } from '../../src/services';
import { Cache } from '../../src/util/cache';

import container from '../../src/inversify.config';

let bApp: Express;
let reviewRepository: Repository<Review>;
let mockRequestAuth: RequestAuthentication;
let mockSettingLoader: SettingLoader;
let mockCache: Cache;
let mockApplicantService: ApplicantService;
let mockEService: EmailService;

const newReviewRequest: any = {
	applicationID: '',
	averageScore: 2.0
};

const testApplicant: Applicant = new Applicant();
testApplicant.age = 20;
testApplicant.gender = 'Test';
testApplicant.nationality = 'UK';
testApplicant.country = 'UK';
testApplicant.city = 'Manchester';
testApplicant.university = 'UoM';
testApplicant.degree = 'CS';
testApplicant.yearOfStudy = 'Foundation';
testApplicant.workArea = 'This';
testApplicant.hackathonCount = 0;
testApplicant.dietaryRequirements = 'Test';
testApplicant.tShirtSize = 'M';
testApplicant.hearAbout = 'IDK';

const requestUser = {
	name: 'Test',
	email: 'test@test.com',
	id: '010101'
};

beforeAll(async () => {
	mockFrontendRenderer();
	mockRequestAuth = mockRequestAuthentication(requestUser);
	mockSettingLoader = mockSettingsLoader();
	mockCache = mockHackathonConfigCache();
	mockEService = mockEmailService();
	mockApplicantService = mock(ApplicantService);

	container.rebind(RequestAuthentication).toConstantValue(instance(mockRequestAuth));
	container.rebind(SettingLoader).toConstantValue(instance(mockSettingLoader));
	container.rebind(Cache).toConstantValue(instance(mockCache));
	container.rebind(EmailService).toConstantValue(instance(mockEService));
	container.rebind(ApplicantService).toConstantValue(instance(mockApplicantService));

	when(mockApplicantService.findOne(objectContaining({ id: '' }))).thenReturn(Promise.resolve(testApplicant));

	bApp = await new App().buildApp(getTestDatabaseOptions());
	// After the application has been built and db connection established -- get the applicant repository
	reviewRepository = container.get<InjectedRepository<Review>>(InjectedRepository).getRepository(Review);
});

beforeEach(() => {
	// Create a snapshot so each unit test can modify it without breaking other unit tests
	container.snapshot();
});

afterEach(() => {
	// Restore to last snapshot so each unit test takes a clean copy of the application container
	container.restore();
});

test('Test review created with valid request', async () => {
	// Perform the request along .../review/submit
	const response = await request(bApp)
		.post('/review/submit')
		.send(newReviewRequest);
	// Check that we get a OK (200) response code
	expect(response.status).toBe(HttpResponseCode.OK);

	// Check that the application has been added to the database
	const createdReview: Review = await reviewRepository.findOne({ createdByAuthID: requestUser.id });

	expect(createdReview.averageScore).toBe(newReviewRequest.averageScore);
	expect(createdReview.createdByAuthID).toBe(requestUser.id);
	expect(createdReview.id).toBeDefined();
	expect(createdReview.createdAt).toBeInstanceOf(Date);
});
