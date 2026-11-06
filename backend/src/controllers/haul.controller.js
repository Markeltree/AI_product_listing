import * as haulService from '../services/haul.service.js';
import { publicOrigin } from '../services/connectLinks.js';

export async function list(req, res) {
  res.json({ hauls: await haulService.listHauls(req.user.id) });
}

export async function create(req, res) {
  const { mime, size } = req.body;
  res.status(201).json(await haulService.createHaul({ user: req.user, mime, size, origin: publicOrigin(req) }));
}

export async function get(req, res) {
  res.json({ haul: await haulService.getHaul(req.user.id, req.params.id) });
}

export async function upload(req, res) {
  await haulService.receiveUpload({ haulId: req.params.id, ticket: req.query.ticket, stream: req });
  res.status(204).end();
}

export async function complete(req, res) {
  res.json({ haul: await haulService.completeUpload(req.user.id, req.params.id) });
}

export async function remove(req, res) {
  await haulService.deleteHaul(req.user.id, req.params.id);
  res.status(204).end();
}
